-- 0014_despacho_items_producto.sql
-- Extiende despacho_items para soportar dos modos:
--   1) "Desde venta": item ligado a una venta confirmada (modelo original).
--   2) "Desde producto": item directo con producto + cantidad, sin venta previa.
--
-- Permite que el admin asigne stock a un vendedor para entregar, aunque la
-- venta aún no exista (caso común: reparto programado por ruta).

alter table public.despacho_items
  alter column venta_id drop not null;

alter table public.despacho_items
  add column if not exists producto_id uuid references public.productos(id) on delete restrict,
  add column if not exists cantidad numeric(14,3) check (cantidad is null or cantidad > 0);

create index if not exists despacho_items_producto_idx
  on public.despacho_items(producto_id);

-- Exactamente uno de los dos orígenes debe estar presente.
alter table public.despacho_items
  drop constraint if exists despacho_items_origen_check;

alter table public.despacho_items
  add constraint despacho_items_origen_check
  check (
    (venta_id is not null and producto_id is null and cantidad is null)
    or
    (venta_id is null and producto_id is not null and cantidad is not null)
  );
