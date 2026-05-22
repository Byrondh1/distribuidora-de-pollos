-- 0015_productos_tipo_unidad.sql
-- Soporte para productos vendidos por peso (libras) además de por unidad.
--
-- Modelo:
--   - tipo_unidad = 'unit'   → precio_base es el precio por unidad
--   - tipo_unidad = 'weight' → precio_libra es el precio por libra (lb)
--
-- venta_items.precio_unitario sigue siendo el precio efectivo usado en la
-- venta (auditoría inline). cantidad acepta decimales (numeric 14,3) y por
-- tanto sirve para libras fraccionales (ej. 3.54 lb).
--
-- Compatibilidad: tipo_unidad default 'unit' → todos los productos
-- existentes quedan como antes, sin cambios de comportamiento en mobile.

create type public.producto_tipo_unidad as enum ('unit', 'weight');

alter table public.productos
  add column tipo_unidad public.producto_tipo_unidad not null default 'unit',
  add column precio_libra numeric(12,2) check (precio_libra is null or precio_libra >= 0);

-- Regla de consistencia: si tipo_unidad='weight', precio_libra es obligatorio.
alter table public.productos
  add constraint productos_precio_libra_required
  check (
    tipo_unidad = 'unit'
    or (tipo_unidad = 'weight' and precio_libra is not null)
  );

-- Permitir a supabase_auth_admin ver los nuevos tipos para introspección.
grant usage on type public.producto_tipo_unidad to supabase_auth_admin;
