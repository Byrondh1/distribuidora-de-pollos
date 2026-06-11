-- 0018_security_hardening.sql
-- Fixes de la auditoría de seguridad/performance/integridad:
--   C1  Vistas sin RLS → security_invoker + filtro de tenant explícito
--   C2  precio_efectivo() SECURITY DEFINER sin validación de tenant
--   C3  Pedidos podían generar ventas a precio 0
--   C4  Líneas duplicadas: unique(venta,producto) y unique(pedido,producto)
--   C6  Venta a crédito sin cliente
--   A2  Índices faltantes
--   A3  confirmar_venta no validaba vendedor
--   A4  Trigger de subtotal O(N²) → statement-level con transition tables
--   A6  Realtime publicando tablas de alta rotación sin suscriptores
--   A7  Precisión numérica inconsistente (12,2 → 14,2)
--   A1  RPC transaccional crear_venta_completa
--   M1  productos_mas_vendidos con filtro de tenant explícito
--   M2  marcar_despacho_item sin lock en transición de estado
--   M3  descuento podía exceder subtotal
--   M4  usuario_id sin default en bitácoras
--   M9  despacho directo sin validar producto activo/stock

-- =====================================================================
-- 1. Drop de vistas de reportes (se recrean al final con invoker +
--    filtro; además bloquean el ALTER TYPE de venta_items.subtotal).
-- =====================================================================
drop view if exists public.reporte_ventas_diarias;
drop view if exists public.reporte_productos_top;
drop view if exists public.reporte_clientes_top;
drop view if exists public.reporte_inventario_critico;
drop view if exists public.reporte_cobranza_resumen;

-- =====================================================================
-- 2. A7: precios a numeric(14,2) (cantidades quedan en 14,3).
--    venta_items.subtotal es columna generada → drop + recreate.
-- =====================================================================
alter table public.productos
  alter column precio_base  type numeric(14,2),
  alter column precio_libra type numeric(14,2);

alter table public.precios_cliente
  alter column precio type numeric(14,2);

alter table public.venta_items drop column subtotal;
alter table public.venta_items alter column precio_unitario type numeric(14,2);
alter table public.venta_items
  add column subtotal numeric(16,2) generated always as (cantidad * precio_unitario) stored;

alter table public.pedido_items
  alter column precio_unitario type numeric(14,2);

-- =====================================================================
-- 3. C4: merge de líneas duplicadas y unique constraints.
-- =====================================================================
with dups as (
  select venta_id, producto_id,
         min(id::text)::uuid as keep_id,
         sum(cantidad)       as total_cantidad
    from public.venta_items
   group by venta_id, producto_id
  having count(*) > 1
)
update public.venta_items vi
   set cantidad = d.total_cantidad
  from dups d
 where vi.id = d.keep_id;

with dups as (
  select venta_id, producto_id, min(id::text)::uuid as keep_id
    from public.venta_items
   group by venta_id, producto_id
  having count(*) > 1
)
delete from public.venta_items vi
 using dups d
 where vi.venta_id = d.venta_id
   and vi.producto_id = d.producto_id
   and vi.id <> d.keep_id;

alter table public.venta_items
  add constraint venta_items_venta_producto_uniq unique (venta_id, producto_id);

with dups as (
  select pedido_id, producto_id,
         min(id::text)::uuid as keep_id,
         sum(cantidad_estimada) as total_estimada,
         case when bool_or(cantidad_final is not null)
              then sum(coalesce(cantidad_final, 0)) end as total_final
    from public.pedido_items
   group by pedido_id, producto_id
  having count(*) > 1
)
update public.pedido_items pi
   set cantidad_estimada = d.total_estimada,
       cantidad_final    = d.total_final
  from dups d
 where pi.id = d.keep_id;

with dups as (
  select pedido_id, producto_id, min(id::text)::uuid as keep_id
    from public.pedido_items
   group by pedido_id, producto_id
  having count(*) > 1
)
delete from public.pedido_items pi
 using dups d
 where pi.pedido_id = d.pedido_id
   and pi.producto_id = d.producto_id
   and pi.id <> d.keep_id;

alter table public.pedido_items
  add constraint pedido_items_pedido_producto_uniq unique (pedido_id, producto_id);

-- =====================================================================
-- 4. C3 + C6: checks de integridad (NOT VALID para no romper data
--    legacy; aplican a filas nuevas/modificadas).
-- =====================================================================
alter table public.pedido_items
  add constraint pedido_items_precio_positivo
  check (precio_unitario > 0) not valid;

alter table public.ventas
  add constraint ventas_credito_requiere_cliente
  check (metodo_pago <> 'credito' or cliente_id is not null) not valid;

-- =====================================================================
-- 5. A2: índices faltantes.
-- =====================================================================
create index if not exists venta_items_producto_idx
  on public.venta_items(producto_id);
create index if not exists pedido_items_producto_idx
  on public.pedido_items(producto_id);
create index if not exists despacho_items_venta_idx
  on public.despacho_items(venta_id);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);
create index if not exists movimientos_inventario_producto_idx
  on public.movimientos_inventario(producto_id, created_at desc);

-- =====================================================================
-- 6. C2: precio_efectivo valida tenant (era SECURITY DEFINER sin filtro
--    → cualquier autenticado leía precios de otros tenants).
-- =====================================================================
create or replace function public.precio_efectivo(
  p_cliente_id uuid,
  p_producto_id uuid
)
returns numeric(14,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pc.precio
       from public.precios_cliente pc
       join public.clientes c on c.id = pc.cliente_id
      where pc.cliente_id = p_cliente_id
        and pc.producto_id = p_producto_id
        and c.company_id = public.current_company_id()
      limit 1),
    (select p.precio_base
       from public.productos p
      where p.id = p_producto_id
        and p.company_id = public.current_company_id()
      limit 1),
    0
  );
$$;

-- =====================================================================
-- 7. M1: productos_mas_vendidos con filtro de tenant explícito
--    (defensa en profundidad — ya respetaba RLS por ser invoker).
-- =====================================================================
create or replace function public.productos_mas_vendidos(
  p_limit int default 8,
  p_dias  int default 60
)
returns table (
  producto_id    uuid,
  veces_vendido  bigint,
  cantidad_total numeric
)
language sql
stable
set search_path = public
as $$
  select vi.producto_id,
         count(*)::bigint          as veces_vendido,
         sum(vi.cantidad)::numeric as cantidad_total
    from public.venta_items vi
    join public.ventas v on v.id = vi.venta_id
   where v.estado = 'confirmada'
     and v.company_id = public.current_company_id()
     and v.fecha >= (current_date - (p_dias || ' days')::interval)::date
   group by vi.producto_id
   order by count(*) desc, sum(vi.cantidad) desc
   limit greatest(1, least(p_limit, 50));
$$;

-- =====================================================================
-- 8. A3 + M3: confirmar_venta endurecida — valida que el caller sea el
--    vendedor de la venta (o admin/service_role) y que el descuento no
--    exceda el subtotal.
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
  if auth.role() <> 'service_role'
     and v.vendedor_id <> auth.uid()
     and public.current_user_role() <> 'admin'
  then
    raise exception 'Solo el vendedor de la venta o un admin puede confirmarla';
  end if;
  if v.estado <> 'borrador' then
    raise exception 'Solo se pueden confirmar ventas en estado borrador (actual: %)', v.estado;
  end if;
  if v.descuento > v.subtotal then
    raise exception 'El descuento (%) no puede superar el subtotal (%)', v.descuento, v.subtotal;
  end if;

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

-- =====================================================================
-- 9. C3 (server-side): confirmar_pedido rechaza ítems a precio 0.
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
  ped          record;
  v_venta_id   uuid;
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
  if exists (
    select 1 from public.pedido_items
     where pedido_id = p_pedido_id
       and coalesce(cantidad_final, cantidad_estimada) > 0
       and precio_unitario <= 0
  ) then
    raise exception 'Hay ítems sin precio asignado; corrige los precios antes de confirmar';
  end if;

  insert into public.ventas (company_id, vendedor_id, cliente_id, fecha, metodo_pago, descuento)
  values (ped.company_id, ped.vendedor_id, ped.cliente_id, current_date, p_metodo_pago, 0)
  returning id into v_venta_id;

  insert into public.venta_items (venta_id, company_id, producto_id, cantidad, precio_unitario)
  select v_venta_id, company_id, producto_id,
         coalesce(cantidad_final, cantidad_estimada),
         precio_unitario
    from public.pedido_items
   where pedido_id = p_pedido_id
     and coalesce(cantidad_final, cantidad_estimada) > 0;

  perform public.confirmar_venta(v_venta_id);

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

-- =====================================================================
-- 10. A4: recálculo de subtotal por sentencia (no por fila).
-- =====================================================================
drop trigger if exists venta_items_recalcular on public.venta_items;

create or replace function public.recalcular_subtotal_venta_stmt()
returns trigger
language plpgsql
as $$
begin
  update public.ventas v
     set subtotal = coalesce(
       (select sum(vi.cantidad * vi.precio_unitario)
          from public.venta_items vi
         where vi.venta_id = v.id),
       0)
   where v.id in (select distinct venta_id from cambios);
  return null;
end;
$$;

create trigger venta_items_recalcular_ins
  after insert on public.venta_items
  referencing new table as cambios
  for each statement execute function public.recalcular_subtotal_venta_stmt();

create trigger venta_items_recalcular_upd
  after update on public.venta_items
  referencing new table as cambios
  for each statement execute function public.recalcular_subtotal_venta_stmt();

create trigger venta_items_recalcular_del
  after delete on public.venta_items
  referencing old table as cambios
  for each statement execute function public.recalcular_subtotal_venta_stmt();

-- =====================================================================
-- 11. M2: marcar_despacho_item con lock del despacho padre para evitar
--     doble cierre concurrente.
-- =====================================================================
create or replace function public.marcar_despacho_item(
  p_item_id uuid,
  p_estado  public.despacho_item_estado,
  p_notas   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_despacho_id  uuid;
  v_vendedor_id  uuid;
  v_company      uuid := public.current_company_id();
  v_pendientes   int;
begin
  select di.despacho_id, d.vendedor_id
    into v_despacho_id, v_vendedor_id
    from public.despacho_items di
    join public.despachos d on d.id = di.despacho_id
   where di.id = p_item_id and di.company_id = v_company
   for update of d;

  if not found then raise exception 'Ítem de despacho no encontrado'; end if;

  if auth.role() <> 'service_role'
     and v_vendedor_id <> auth.uid()
     and public.current_user_role() <> 'admin'
  then
    raise exception 'No autorizado';
  end if;

  update public.despacho_items
     set estado       = p_estado,
         notas        = coalesce(p_notas, notas),
         entregado_at = case when p_estado = 'entregado' then now() else entregado_at end
   where id = p_item_id;

  select count(*) into v_pendientes
    from public.despacho_items
   where despacho_id = v_despacho_id
     and estado = 'pendiente';

  if v_pendientes = 0 then
    update public.despachos
       set estado = case
         when not exists (
           select 1 from public.despacho_items
            where despacho_id = v_despacho_id and estado = 'fallido'
         ) then 'entregado'
         else 'fallido'
       end
     where id = v_despacho_id;
  elsif (select estado from public.despachos where id = v_despacho_id) = 'pendiente' then
    update public.despachos set estado = 'en_ruta' where id = v_despacho_id;
  end if;
end;
$$;

-- =====================================================================
-- 12. M4: bitácoras siempre capturan al usuario por default.
-- =====================================================================
alter table public.movimientos_inventario
  alter column usuario_id set default auth.uid();
alter table public.pagos_credito
  alter column usuario_id set default auth.uid();

-- =====================================================================
-- 13. M9: despacho directo valida producto activo y stock disponible.
-- =====================================================================
create or replace function public.validar_despacho_item_producto()
returns trigger
language plpgsql
as $$
declare
  v_activo boolean;
  v_stock  numeric(14,3);
begin
  if new.producto_id is not null then
    select p.activo, coalesce(i.stock, 0)
      into v_activo, v_stock
      from public.productos p
      left join public.inventario i on i.producto_id = p.id
     where p.id = new.producto_id;

    if v_activo is distinct from true then
      raise exception 'El producto no está activo';
    end if;
    if new.cantidad is null or new.cantidad <= 0 then
      raise exception 'Cantidad de despacho inválida';
    end if;
    if new.cantidad > v_stock then
      raise exception 'Stock insuficiente para despachar: disponible=% requerido=%',
        v_stock, new.cantidad;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists despacho_items_validar_producto on public.despacho_items;
create trigger despacho_items_validar_producto
  before insert or update on public.despacho_items
  for each row execute function public.validar_despacho_item_producto();

-- =====================================================================
-- 14. A6: podar Realtime — quedan solo las tablas con suscriptores
--     reales (inventario en web/mobile, pedidos en nav) más cabeceras
--     de bajo churn. Se quitan las de alta rotación sin suscriptores.
-- =====================================================================
alter publication supabase_realtime drop table public.productos;
alter publication supabase_realtime drop table public.movimientos_inventario;
alter publication supabase_realtime drop table public.clientes;
alter publication supabase_realtime drop table public.pedido_items;
alter publication supabase_realtime drop table public.despacho_items;

-- =====================================================================
-- 15. C1: vistas con security_invoker (aplican RLS del caller) y filtro
--     de tenant explícito como defensa en profundidad.
-- =====================================================================
create or replace view public.caja_resumen
with (security_invoker = on) as
select
  c.id           as caja_id,
  c.company_id,
  c.vendedor_id,
  c.fecha,
  c.monto_apertura,
  c.monto_cierre,
  c.estado,
  c.notas_cierre,
  coalesce(sum(v.total) filter (where v.metodo_pago = 'efectivo'),      0) as total_efectivo,
  coalesce(sum(v.total) filter (where v.metodo_pago = 'transferencia'), 0) as total_transferencia,
  coalesce(sum(v.total) filter (where v.metodo_pago = 'credito'),       0) as total_credito,
  coalesce(sum(v.total),                                                0) as total_ventas,
  count(v.id)                                                           as num_ventas
from public.cajas c
left join public.ventas v
  on v.vendedor_id = c.vendedor_id
 and v.fecha       = c.fecha
 and v.company_id  = c.company_id
 and v.estado      = 'confirmada'
where c.company_id = public.current_company_id()
group by c.id;

create view public.reporte_ventas_diarias
with (security_invoker = on) as
select
  v.company_id,
  v.fecha,
  v.metodo_pago,
  count(*)         as num_ventas,
  sum(v.total)     as total,
  sum(v.descuento) as total_descuentos,
  count(distinct v.cliente_id) filter (where v.cliente_id is not null) as clientes_atendidos
from public.ventas v
where v.estado = 'confirmada'
  and v.company_id = public.current_company_id()
group by v.company_id, v.fecha, v.metodo_pago
order by v.fecha desc, v.metodo_pago;

create view public.reporte_productos_top
with (security_invoker = on) as
select
  vi.company_id,
  p.id          as producto_id,
  p.sku,
  p.nombre,
  p.categoria,
  p.unidad,
  sum(vi.cantidad)     as cantidad_total,
  sum(vi.subtotal)     as monto_total,
  count(distinct v.id) as num_ventas
from public.venta_items vi
join public.productos p on p.id = vi.producto_id
join public.ventas    v on v.id = vi.venta_id
where v.estado = 'confirmada'
  and v.company_id = public.current_company_id()
group by vi.company_id, p.id, p.sku, p.nombre, p.categoria, p.unidad
order by monto_total desc;

create view public.reporte_clientes_top
with (security_invoker = on) as
select
  v.company_id,
  c.id          as cliente_id,
  c.nombre,
  c.telefono,
  count(v.id) as num_ventas,
  sum(v.total) as monto_total,
  max(v.fecha) as ultima_compra,
  sum(case when v.metodo_pago = 'credito' then v.total else 0 end) as total_credito
from public.ventas v
join public.clientes c on c.id = v.cliente_id
where v.estado = 'confirmada'
  and v.company_id = public.current_company_id()
group by v.company_id, c.id, c.nombre, c.telefono
order by monto_total desc;

create view public.reporte_inventario_critico
with (security_invoker = on) as
select
  p.company_id,
  p.id,
  p.sku,
  p.nombre,
  p.categoria,
  p.unidad,
  i.stock,
  i.stock_minimo,
  (i.stock_minimo - i.stock) as deficit
from public.inventario i
join public.productos p on p.id = i.producto_id
where i.stock <= i.stock_minimo
  and p.activo = true
  and p.company_id = public.current_company_id()
order by deficit desc;

create view public.reporte_cobranza_resumen
with (security_invoker = on) as
select
  cr.company_id,
  cr.estado,
  count(*)                  as num_creditos,
  sum(cr.saldo_pendiente)   as saldo_total,
  sum(cr.monto_original)    as monto_original_total,
  min(cr.fecha_vencimiento) as proximo_vencimiento
from public.creditos cr
where cr.company_id = public.current_company_id()
group by cr.company_id, cr.estado;

-- =====================================================================
-- 16. A1: crear_venta_completa — venta + ítems + confirmación en una
--     sola transacción. Evita ventas huérfanas si falla a mitad.
--     p_items: [{"producto_id": uuid, "cantidad": num, "precio_unitario": num}]
-- =====================================================================
create or replace function public.crear_venta_completa(
  p_cliente_id  uuid,
  p_metodo_pago public.metodo_pago,
  p_items       jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company   uuid := public.current_company_id();
  v_venta_id  uuid;
  item        jsonb;
  v_prod      uuid;
  v_cant      numeric;
  v_precio    numeric;
begin
  if v_company is null then
    raise exception 'Sesión sin empresa asignada';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta requiere al menos un ítem';
  end if;
  if p_metodo_pago = 'credito' and p_cliente_id is null then
    raise exception 'Las ventas a crédito requieren un cliente';
  end if;
  if p_cliente_id is not null and not exists (
    select 1 from public.clientes c
     where c.id = p_cliente_id and c.company_id = v_company
  ) then
    raise exception 'Cliente no válido';
  end if;

  insert into public.ventas (company_id, vendedor_id, cliente_id, fecha, metodo_pago, descuento)
  values (v_company, auth.uid(), p_cliente_id, current_date, p_metodo_pago, 0)
  returning id into v_venta_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_prod   := (item ->> 'producto_id')::uuid;
    v_cant   := (item ->> 'cantidad')::numeric;
    v_precio := (item ->> 'precio_unitario')::numeric;

    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida para producto %', v_prod;
    end if;
    if v_precio is null or v_precio <= 0 then
      raise exception 'Precio inválido para producto %', v_prod;
    end if;
    if not exists (
      select 1 from public.productos p
       where p.id = v_prod and p.company_id = v_company and p.activo = true
    ) then
      raise exception 'Producto % no válido', v_prod;
    end if;

    insert into public.venta_items (venta_id, company_id, producto_id, cantidad, precio_unitario)
    values (v_venta_id, v_company, v_prod, v_cant, v_precio);
  end loop;

  perform public.confirmar_venta(v_venta_id);
  return v_venta_id;
end;
$$;

revoke all on function public.crear_venta_completa(uuid, public.metodo_pago, jsonb) from public;
grant execute on function public.crear_venta_completa(uuid, public.metodo_pago, jsonb)
  to authenticated, service_role;
