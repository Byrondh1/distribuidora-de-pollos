-- 0007_ventas.sql
-- Ventas (cabecera + ítems) con soporte efectivo/transferencia/crédito.
-- Al confirmar una venta se generan movimientos de salida en inventario.

create type public.metodo_pago as enum ('efectivo', 'transferencia', 'credito');
create type public.venta_estado as enum ('borrador', 'confirmada', 'anulada');

-- =====================================================================
-- ventas (cabecera)
-- =====================================================================
create table public.ventas (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  vendedor_id  uuid not null references auth.users(id),
  cliente_id   uuid references public.clientes(id) on delete set null,
  fecha        date not null default current_date,
  subtotal     numeric(14,2) not null default 0,
  descuento    numeric(14,2) not null default 0 check (descuento >= 0),
  total        numeric(14,2) generated always as (subtotal - descuento) stored,
  metodo_pago  public.metodo_pago not null default 'efectivo',
  estado       public.venta_estado not null default 'borrador',
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ventas_company_fecha_idx    on public.ventas(company_id, fecha desc);
create index ventas_vendedor_idx         on public.ventas(vendedor_id);
create index ventas_cliente_idx          on public.ventas(cliente_id);

create trigger ventas_set_updated_at
  before update on public.ventas
  for each row execute function public.set_updated_at();

-- =====================================================================
-- venta_items
-- =====================================================================
create table public.venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references public.ventas(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  producto_id     uuid not null references public.productos(id) on delete restrict,
  cantidad        numeric(14,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal        numeric(14,2) generated always as (cantidad * precio_unitario) stored
);

create index venta_items_venta_idx   on public.venta_items(venta_id);
create index venta_items_company_idx on public.venta_items(company_id);

-- =====================================================================
-- Recalcula subtotal de la cabecera al insertar/actualizar/borrar items.
-- =====================================================================
create or replace function public.recalcular_subtotal_venta()
returns trigger
language plpgsql
as $$
declare
  v_venta_id uuid;
  v_subtotal  numeric(14,2);
begin
  v_venta_id := coalesce(new.venta_id, old.venta_id);
  select coalesce(sum(cantidad * precio_unitario), 0)
    into v_subtotal
    from public.venta_items
   where venta_id = v_venta_id;

  update public.ventas set subtotal = v_subtotal where id = v_venta_id;
  return coalesce(new, old);
end;
$$;

create trigger venta_items_recalcular
  after insert or update or delete on public.venta_items
  for each row execute function public.recalcular_subtotal_venta();

-- =====================================================================
-- confirmar_venta: valida stock, genera movimientos de salida y bloquea
-- la venta como 'confirmada'. Callable por el vendedor desde el cliente.
-- =====================================================================
create or replace function public.confirmar_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v         record;
  item      record;
  inv_stock numeric(14,3);
begin
  select * into v from public.ventas where id = p_venta_id for update;
  if not found then
    raise exception 'Venta % no encontrada', p_venta_id;
  end if;
  if v.company_id <> public.current_company_id() then
    raise exception 'No autorizado';
  end if;
  if v.estado <> 'borrador' then
    raise exception 'Solo se pueden confirmar ventas en estado borrador (actual: %)', v.estado;
  end if;

  -- Validar stock suficiente para cada ítem.
  for item in
    select vi.producto_id, vi.cantidad, p.nombre
      from public.venta_items vi
      join public.productos p on p.id = vi.producto_id
     where vi.venta_id = p_venta_id
  loop
    select stock into inv_stock
      from public.inventario
     where producto_id = item.producto_id
     for update;

    if inv_stock < item.cantidad then
      raise exception 'Stock insuficiente para "%": disponible=% requerido=%',
        item.nombre, inv_stock, item.cantidad;
    end if;
  end loop;

  -- Crear movimientos de salida (el trigger descuenta el stock).
  for item in
    select vi.producto_id, vi.cantidad
      from public.venta_items vi
     where vi.venta_id = p_venta_id
  loop
    insert into public.movimientos_inventario
      (company_id, producto_id, tipo, cantidad, motivo, usuario_id)
    values
      (v.company_id, item.producto_id, 'salida', item.cantidad,
       'Venta ' || p_venta_id::text, v.vendedor_id);
  end loop;

  update public.ventas set estado = 'confirmada' where id = p_venta_id;
end;
$$;

revoke all on function public.confirmar_venta(uuid) from public;
grant execute on function public.confirmar_venta(uuid) to authenticated, service_role;

-- =====================================================================
-- anular_venta: devuelve stock (movimientos de entrada). Solo admin.
-- =====================================================================
create or replace function public.anular_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v    record;
  item record;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Solo admin puede anular ventas';
  end if;

  select * into v from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'Venta % no encontrada', p_venta_id; end if;
  if v.company_id <> public.current_company_id() then raise exception 'No autorizado'; end if;
  if v.estado = 'anulada' then raise exception 'La venta ya está anulada'; end if;

  if v.estado = 'confirmada' then
    for item in
      select vi.producto_id, vi.cantidad
        from public.venta_items vi
       where vi.venta_id = p_venta_id
    loop
      insert into public.movimientos_inventario
        (company_id, producto_id, tipo, cantidad, motivo, usuario_id)
      values
        (v.company_id, item.producto_id, 'entrada', item.cantidad,
         'Devolución anulación venta ' || p_venta_id::text, auth.uid());
    end loop;
  end if;

  update public.ventas set estado = 'anulada' where id = p_venta_id;
end;
$$;

revoke all on function public.anular_venta(uuid) from public;
grant execute on function public.anular_venta(uuid) to authenticated, service_role;

-- Audit
create trigger audit_ventas
  after insert or update or delete on public.ventas
  for each row execute function public.audit_trigger();

-- Realtime
alter publication supabase_realtime add table public.ventas;

-- RLS -----------------------------------------------------------------------
alter table public.ventas      enable row level security;
alter table public.venta_items enable row level security;

-- ventas: admin ve todas del tenant; vendedor ve solo las suyas.
drop policy if exists ventas_admin_all on public.ventas;
create policy ventas_admin_all
  on public.ventas for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

drop policy if exists ventas_vendedor_own on public.ventas;
create policy ventas_vendedor_own
  on public.ventas for all to authenticated
  using (company_id = public.current_company_id() and vendedor_id = auth.uid())
  with check (
    company_id = public.current_company_id()
    and vendedor_id = auth.uid()
    and estado = 'borrador'    -- vendedor solo puede crear/editar borradores
  );

-- venta_items: hereda acceso de la venta padre.
drop policy if exists venta_items_admin_all on public.venta_items;
create policy venta_items_admin_all
  on public.venta_items for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

drop policy if exists venta_items_vendedor_own on public.venta_items;
create policy venta_items_vendedor_own
  on public.venta_items for all to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.ventas v
       where v.id = venta_id and v.vendedor_id = auth.uid() and v.estado = 'borrador'
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.ventas v
       where v.id = venta_id and v.vendedor_id = auth.uid() and v.estado = 'borrador'
    )
  );
