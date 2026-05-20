-- 0008_caja.sql
-- Caja diaria: apertura, arqueo y cierre por vendedor.
-- Un vendedor solo puede tener una caja abierta por día.

create type public.caja_estado as enum ('abierta', 'cerrada');

create table public.cajas (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  vendedor_id    uuid not null references auth.users(id),
  fecha          date not null default current_date,
  monto_apertura numeric(14,2) not null default 0 check (monto_apertura >= 0),
  monto_cierre   numeric(14,2),
  estado         public.caja_estado not null default 'abierta',
  notas_cierre   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (vendedor_id, fecha)          -- solo 1 caja por vendedor por día
);

create index cajas_company_fecha_idx on public.cajas(company_id, fecha desc);
create index cajas_vendedor_idx       on public.cajas(vendedor_id);

create trigger cajas_set_updated_at
  before update on public.cajas
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Vista: resumen de caja por día (ventas confirmadas del vendedor).
-- El admin la usa para el arqueo; no es una tabla, evita doble escritura.
-- =====================================================================
create or replace view public.caja_resumen as
select
  c.id                                                       as caja_id,
  c.company_id,
  c.vendedor_id,
  c.fecha,
  c.monto_apertura,
  c.monto_cierre,
  c.estado,
  c.notas_cierre,
  coalesce(sum(v.total) filter (where v.metodo_pago = 'efectivo'),      0) as total_efectivo,
  coalesce(sum(v.total) filter (where v.metodo_pago = 'transferencia'),  0) as total_transferencia,
  coalesce(sum(v.total) filter (where v.metodo_pago = 'credito'),        0) as total_credito,
  coalesce(sum(v.total),                                                  0) as total_ventas,
  count(v.id)                                                            as num_ventas
from public.cajas c
left join public.ventas v
  on v.vendedor_id = c.vendedor_id
 and v.fecha       = c.fecha
 and v.company_id  = c.company_id
 and v.estado      = 'confirmada'
group by c.id;

-- =====================================================================
-- abrir_caja: crea la caja del día si no existe.
-- =====================================================================
create or replace function public.abrir_caja(p_monto_apertura numeric default 0)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caja_id uuid;
  v_company  uuid := public.current_company_id();
begin
  if v_company is null then raise exception 'Sin empresa en JWT'; end if;

  insert into public.cajas (company_id, vendedor_id, fecha, monto_apertura)
  values (v_company, auth.uid(), current_date, p_monto_apertura)
  on conflict (vendedor_id, fecha) do update
    set monto_apertura = excluded.monto_apertura
  where cajas.estado = 'abierta'
  returning id into v_caja_id;

  -- Si el ON CONFLICT no afectó (ya cerrada) lanzar error.
  if v_caja_id is null then
    select id into v_caja_id from public.cajas
     where vendedor_id = auth.uid() and fecha = current_date;
    raise exception 'La caja del % ya está cerrada (id=%)', current_date, v_caja_id;
  end if;

  return v_caja_id;
end;
$$;

revoke all on function public.abrir_caja(numeric) from public;
grant execute on function public.abrir_caja(numeric) to authenticated;

-- =====================================================================
-- cerrar_caja: registra monto de cierre y bloquea la caja.
-- =====================================================================
create or replace function public.cerrar_caja(
  p_monto_cierre numeric,
  p_notas        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
begin
  update public.cajas
     set estado       = 'cerrada',
         monto_cierre = p_monto_cierre,
         notas_cierre = p_notas
   where vendedor_id = auth.uid()
     and fecha       = current_date
     and company_id  = v_company
     and estado      = 'abierta';

  if not found then
    raise exception 'No hay caja abierta hoy para este vendedor';
  end if;
end;
$$;

revoke all on function public.cerrar_caja(numeric, text) from public;
grant execute on function public.cerrar_caja(numeric, text) to authenticated;

-- Audit + Realtime
create trigger audit_cajas
  after insert or update or delete on public.cajas
  for each row execute function public.audit_trigger();

alter publication supabase_realtime add table public.cajas;

-- RLS -----------------------------------------------------------------------
alter table public.cajas enable row level security;

drop policy if exists cajas_vendedor_own on public.cajas;
create policy cajas_vendedor_own
  on public.cajas for all to authenticated
  using (company_id = public.current_company_id() and vendedor_id = auth.uid())
  with check (company_id = public.current_company_id() and vendedor_id = auth.uid());

drop policy if exists cajas_admin_all on public.cajas;
create policy cajas_admin_all
  on public.cajas for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');
