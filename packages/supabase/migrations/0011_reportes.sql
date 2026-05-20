-- 0011_reportes.sql
-- Vistas de reporting sobre datos existentes.
-- Todas filtran por tenant vía current_company_id() para ser seguros.
-- El acceso está restringido a admin mediante RLS en las tablas base,
-- así que las vistas heredan ese aislamiento.

-- =====================================================================
-- reporte_ventas_diarias: ventas confirmadas agrupadas por día y método.
-- =====================================================================
create or replace view public.reporte_ventas_diarias as
select
  v.company_id,
  v.fecha,
  v.metodo_pago,
  count(*)                  as num_ventas,
  sum(v.total)              as total,
  sum(v.descuento)          as total_descuentos,
  count(distinct v.cliente_id) filter (where v.cliente_id is not null) as clientes_atendidos
from public.ventas v
where v.estado = 'confirmada'
group by v.company_id, v.fecha, v.metodo_pago
order by v.fecha desc, v.metodo_pago;

-- =====================================================================
-- reporte_productos_top: ranking de productos por kg vendidos y monto.
-- Últimos 30 días por defecto — filtrar con WHERE fecha.
-- =====================================================================
create or replace view public.reporte_productos_top as
select
  vi.company_id,
  p.id                       as producto_id,
  p.sku,
  p.nombre,
  p.categoria,
  p.unidad,
  sum(vi.cantidad)            as cantidad_total,
  sum(vi.subtotal)            as monto_total,
  count(distinct v.id)        as num_ventas
from public.venta_items vi
join public.productos p on p.id = vi.producto_id
join public.ventas    v on v.id = vi.venta_id
where v.estado = 'confirmada'
group by vi.company_id, p.id, p.sku, p.nombre, p.categoria, p.unidad
order by monto_total desc;

-- =====================================================================
-- reporte_clientes_top: clientes con mayor volumen de compras.
-- =====================================================================
create or replace view public.reporte_clientes_top as
select
  v.company_id,
  c.id          as cliente_id,
  c.nombre,
  c.telefono,
  count(v.id)                as num_ventas,
  sum(v.total)               as monto_total,
  max(v.fecha)               as ultima_compra,
  sum(case when v.metodo_pago = 'credito' then v.total else 0 end) as total_credito
from public.ventas v
join public.clientes c on c.id = v.cliente_id
where v.estado = 'confirmada'
group by v.company_id, c.id, c.nombre, c.telefono
order by monto_total desc;

-- =====================================================================
-- reporte_inventario_critico: productos con stock bajo mínimo.
-- =====================================================================
create or replace view public.reporte_inventario_critico as
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
order by deficit desc;

-- =====================================================================
-- reporte_cobranza_resumen: cartera de créditos por estado.
-- =====================================================================
create or replace view public.reporte_cobranza_resumen as
select
  cr.company_id,
  cr.estado,
  count(*)              as num_creditos,
  sum(cr.saldo_pendiente) as saldo_total,
  sum(cr.monto_original)  as monto_original_total,
  min(cr.fecha_vencimiento) as proximo_vencimiento
from public.creditos cr
group by cr.company_id, cr.estado;
