-- 0009_creditos.sql
-- Créditos y cobranza: generados automáticamente al confirmar ventas a crédito.

create type public.credito_estado as enum ('vigente', 'pagado', 'vencido');

create table public.creditos (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  venta_id         uuid not null references public.ventas(id) on delete restrict,
  monto_original   numeric(14,2) not null check (monto_original > 0),
  saldo_pendiente  numeric(14,2) not null check (saldo_pendiente >= 0),
  fecha_emision    date not null default current_date,
  fecha_vencimiento date,
  estado           public.credito_estado not null default 'vigente',
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (venta_id)    -- 1 crédito por venta
);

create index creditos_company_idx   on public.creditos(company_id);
create index creditos_cliente_idx   on public.creditos(cliente_id);
create index creditos_estado_idx    on public.creditos(estado);

create trigger creditos_set_updated_at
  before update on public.creditos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- pagos_credito: abonos parciales o totales.
-- =====================================================================
create table public.pagos_credito (
  id          uuid primary key default gen_random_uuid(),
  credito_id  uuid not null references public.creditos(id) on delete restrict,
  company_id  uuid not null references public.companies(id) on delete cascade,
  monto       numeric(14,2) not null check (monto > 0),
  fecha       date not null default current_date,
  metodo_pago public.metodo_pago not null default 'efectivo',
  notas       text,
  usuario_id  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index pagos_credito_credito_idx on public.pagos_credito(credito_id);
create index pagos_credito_company_idx on public.pagos_credito(company_id);

-- =====================================================================
-- Trigger: al insertar un pago, descuenta el saldo y cierra el crédito
-- si queda en cero.
-- =====================================================================
create or replace function public.aplicar_pago_credito()
returns trigger
language plpgsql
as $$
declare
  v_saldo numeric(14,2);
begin
  select saldo_pendiente into v_saldo
    from public.creditos
   where id = new.credito_id
   for update;

  if new.monto > v_saldo then
    raise exception 'El pago (%) supera el saldo pendiente (%)', new.monto, v_saldo;
  end if;

  update public.creditos
     set saldo_pendiente = saldo_pendiente - new.monto,
         estado = case when saldo_pendiente - new.monto = 0 then 'pagado' else estado end
   where id = new.credito_id;

  return new;
end;
$$;

create trigger pagos_credito_aplicar
  after insert on public.pagos_credito
  for each row execute function public.aplicar_pago_credito();

-- =====================================================================
-- Trigger en ventas: al confirmar una venta a crédito, crear el crédito
-- automáticamente (requiere cliente_id).
-- =====================================================================
create or replace function public.crear_credito_si_aplica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo actuar cuando la venta pasa de borrador → confirmada y es crédito.
  if old.estado = 'borrador' and new.estado = 'confirmada' and new.metodo_pago = 'credito' then
    if new.cliente_id is null then
      raise exception 'Las ventas a crédito requieren un cliente asignado';
    end if;

    insert into public.creditos (
      company_id, cliente_id, venta_id,
      monto_original, saldo_pendiente,
      fecha_emision, fecha_vencimiento
    ) values (
      new.company_id,
      new.cliente_id,
      new.id,
      new.total,
      new.total,
      new.fecha,
      new.fecha + interval '30 days'  -- vencimiento por defecto: 30 días
    )
    on conflict (venta_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger ventas_crear_credito
  after update on public.ventas
  for each row execute function public.crear_credito_si_aplica();

-- =====================================================================
-- marcar_creditos_vencidos: job que el admin puede llamar periódicamente
-- (o un pg_cron si está disponible). Marca vencidos los créditos cuya
-- fecha_vencimiento ya pasó y aún tienen saldo.
-- =====================================================================
create or replace function public.marcar_creditos_vencidos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Solo admin puede ejecutar esta función';
  end if;

  update public.creditos
     set estado = 'vencido'
   where company_id = public.current_company_id()
     and estado = 'vigente'
     and fecha_vencimiento < current_date
     and saldo_pendiente > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.marcar_creditos_vencidos() from public;
grant execute on function public.marcar_creditos_vencidos() to authenticated;

-- Audit + Realtime
create trigger audit_creditos
  after insert or update or delete on public.creditos
  for each row execute function public.audit_trigger();

create trigger audit_pagos_credito
  after insert on public.pagos_credito
  for each row execute function public.audit_trigger();

alter publication supabase_realtime add table public.creditos;

-- RLS -----------------------------------------------------------------------
alter table public.creditos      enable row level security;
alter table public.pagos_credito enable row level security;

create policy creditos_tenant_select
  on public.creditos for select to authenticated
  using (company_id = public.current_company_id());

create policy creditos_admin_write
  on public.creditos for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

create policy pagos_credito_tenant_select
  on public.pagos_credito for select to authenticated
  using (company_id = public.current_company_id());

create policy pagos_credito_insert
  on public.pagos_credito for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.creditos cr
       where cr.id = credito_id and cr.company_id = public.current_company_id()
    )
  );
