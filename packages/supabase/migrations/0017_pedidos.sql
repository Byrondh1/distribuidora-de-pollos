-- 0017_pedidos.sql
-- Sistema de pedidos: admin crea pedidos por anticipado para clientes y
-- asigna a un vendedor; vendedor edita y confirma → genera una venta.
--
-- Compatibilidad: el flujo de Nueva Venta directa sigue funcionando
-- exactamente igual; este módulo es paralelo y genera ventas vía RPC.

-- =====================================================================
-- ENUM de estados
-- =====================================================================
create type public.pedido_estado as enum (
  'pendiente',   -- creado por admin, vendedor aún no abrió
  'en_ruta',     -- vendedor lo abrió / está trabajando en él
  'completado',  -- confirmado sin cambios respecto al original
  'parcial',     -- confirmado con cambios (cantidades distintas)
  'cancelado'    -- no se pudo entregar
);

grant usage on type public.pedido_estado to supabase_auth_admin;

-- =====================================================================
-- pedidos (cabecera)
-- =====================================================================
create table public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete restrict,
  vendedor_id     uuid not null references public.profiles(id) on delete restrict,
  creado_por      uuid not null references public.profiles(id),
  fecha_entrega   date not null,
  estado          public.pedido_estado not null default 'pendiente',
  notas           text,
  venta_id        uuid references public.ventas(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index pedidos_company_fecha_idx on public.pedidos(company_id, fecha_entrega);
create index pedidos_vendedor_estado_idx on public.pedidos(vendedor_id, estado);

create trigger pedidos_set_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- pedido_items
-- =====================================================================
create table public.pedido_items (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid not null references public.pedidos(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  producto_id       uuid not null references public.productos(id) on delete restrict,
  cantidad_estimada numeric(14,3) not null check (cantidad_estimada > 0),
  cantidad_final    numeric(14,3) check (cantidad_final is null or cantidad_final >= 0),
  precio_unitario   numeric(12,2) not null default 0 check (precio_unitario >= 0),
  notas             text
);

create index pedido_items_pedido_idx on public.pedido_items(pedido_id);

-- =====================================================================
-- confirmar_pedido(id, metodo): genera la venta a partir del pedido.
-- Usa cantidad_final si existe, sino cantidad_estimada. Marca el pedido
-- como 'parcial' si hubo cambios, 'completado' si no.
-- =====================================================================
create or replace function public.confirmar_pedido(
  p_pedido_id   uuid,
  p_metodo_pago public.metodo_pago default 'efectivo'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ped         record;
  v_venta_id  uuid;
  hubo_cambios boolean;
begin
  select * into ped from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'Pedido % no encontrado', p_pedido_id; end if;
  if ped.company_id <> public.current_company_id() then
    raise exception 'No autorizado';
  end if;
  if auth.uid() <> ped.vendedor_id and public.current_user_role() <> 'admin' then
    raise exception 'Solo el vendedor asignado o un admin puede confirmar este pedido';
  end if;
  if ped.estado not in ('pendiente', 'en_ruta', 'parcial') then
    raise exception 'No se puede confirmar un pedido en estado %', ped.estado;
  end if;
  if ped.venta_id is not null then
    raise exception 'Este pedido ya tiene una venta asociada (%)', ped.venta_id;
  end if;
  if not exists (select 1 from public.pedido_items where pedido_id = p_pedido_id) then
    raise exception 'El pedido no tiene ítems';
  end if;

  -- Crear venta en borrador con el vendedor asignado al pedido.
  insert into public.ventas (company_id, vendedor_id, cliente_id, fecha, metodo_pago, descuento)
  values (ped.company_id, ped.vendedor_id, ped.cliente_id, current_date, p_metodo_pago, 0)
  returning id into v_venta_id;

  -- Copiar ítems usando cantidad_final si existe, sino cantidad_estimada.
  insert into public.venta_items (venta_id, company_id, producto_id, cantidad, precio_unitario)
  select v_venta_id, company_id, producto_id,
         coalesce(cantidad_final, cantidad_estimada),
         precio_unitario
    from public.pedido_items
   where pedido_id = p_pedido_id
     and coalesce(cantidad_final, cantidad_estimada) > 0;

  -- Confirma la venta: valida stock y descuenta inventario.
  perform public.confirmar_venta(v_venta_id);

  -- Detectar si hubo cambios respecto al pedido original.
  select exists (
    select 1 from public.pedido_items
     where pedido_id = p_pedido_id
       and cantidad_final is not null
       and cantidad_final <> cantidad_estimada
  ) into hubo_cambios;

  update public.pedidos
     set estado   = case when hubo_cambios then 'parcial'::public.pedido_estado
                         else 'completado'::public.pedido_estado end,
         venta_id = v_venta_id
   where id = p_pedido_id;

  return v_venta_id;
end;
$$;

revoke all on function public.confirmar_pedido(uuid, public.metodo_pago) from public;
grant execute on function public.confirmar_pedido(uuid, public.metodo_pago)
  to authenticated, service_role;

-- =====================================================================
-- cancelar_pedido(id, motivo)
-- =====================================================================
create or replace function public.cancelar_pedido(p_pedido_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare ped record;
begin
  select * into ped from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'Pedido % no encontrado', p_pedido_id; end if;
  if ped.company_id <> public.current_company_id() then raise exception 'No autorizado'; end if;
  if auth.uid() <> ped.vendedor_id and public.current_user_role() <> 'admin' then
    raise exception 'Solo el vendedor asignado o un admin puede cancelar';
  end if;
  if ped.estado in ('completado', 'cancelado') then
    raise exception 'No se puede cancelar un pedido en estado %', ped.estado;
  end if;
  update public.pedidos
     set estado = 'cancelado',
         notas  = coalesce(notas || E'\n', '') || coalesce('Cancelado: ' || p_motivo, 'Cancelado')
   where id = p_pedido_id;
end;
$$;

revoke all on function public.cancelar_pedido(uuid, text) from public;
grant execute on function public.cancelar_pedido(uuid, text) to authenticated, service_role;

-- =====================================================================
-- marcar_pedido_en_ruta(id): vendedor lo "ve/abre", quita del badge.
-- =====================================================================
create or replace function public.marcar_pedido_en_ruta(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare ped record;
begin
  select * into ped from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'Pedido % no encontrado', p_pedido_id; end if;
  if ped.company_id <> public.current_company_id() then raise exception 'No autorizado'; end if;
  if auth.uid() <> ped.vendedor_id and public.current_user_role() <> 'admin' then
    raise exception 'Solo el vendedor asignado puede marcar en ruta';
  end if;
  if ped.estado = 'pendiente' then
    update public.pedidos set estado = 'en_ruta' where id = p_pedido_id;
  end if;
end;
$$;

revoke all on function public.marcar_pedido_en_ruta(uuid) from public;
grant execute on function public.marcar_pedido_en_ruta(uuid) to authenticated, service_role;

-- =====================================================================
-- Audit
-- =====================================================================
create trigger audit_pedidos
  after insert or update or delete on public.pedidos
  for each row execute function public.audit_trigger();

-- =====================================================================
-- Realtime
-- =====================================================================
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.pedido_items;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.pedidos      enable row level security;
alter table public.pedido_items enable row level security;

-- pedidos: admin → todo del tenant; vendedor → solo los suyos.
drop policy if exists pedidos_admin_all on public.pedidos;
create policy pedidos_admin_all
  on public.pedidos for all to authenticated
  using  (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

drop policy if exists pedidos_vendedor_select on public.pedidos;
create policy pedidos_vendedor_select
  on public.pedidos for select to authenticated
  using  (company_id = public.current_company_id() and vendedor_id = auth.uid());

-- vendedor puede UPDATE solo cambios mínimos (notas, estado vía RPC).
-- La transición de estado real va por RPCs SECURITY DEFINER.
drop policy if exists pedidos_vendedor_update on public.pedidos;
create policy pedidos_vendedor_update
  on public.pedidos for update to authenticated
  using  (company_id = public.current_company_id() and vendedor_id = auth.uid())
  with check (company_id = public.current_company_id() and vendedor_id = auth.uid());

-- pedido_items: admin → todo; vendedor → solo si el pedido es suyo
-- y está en estado editable (pendiente | en_ruta).
drop policy if exists pedido_items_admin_all on public.pedido_items;
create policy pedido_items_admin_all
  on public.pedido_items for all to authenticated
  using  (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

drop policy if exists pedido_items_vendedor_select on public.pedido_items;
create policy pedido_items_vendedor_select
  on public.pedido_items for select to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id and p.vendedor_id = auth.uid()
    )
  );

drop policy if exists pedido_items_vendedor_write on public.pedido_items;
create policy pedido_items_vendedor_write
  on public.pedido_items for all to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.vendedor_id = auth.uid()
         and p.estado in ('pendiente', 'en_ruta')
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.vendedor_id = auth.uid()
         and p.estado in ('pendiente', 'en_ruta')
    )
  );
