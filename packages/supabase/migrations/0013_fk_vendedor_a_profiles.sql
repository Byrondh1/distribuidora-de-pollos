-- 0013_fk_vendedor_a_profiles.sql
-- Problema: "Could not find a relationship between 'X' and 'profiles' in the schema cache"
--
-- PostgREST solo puede traversar FKs dentro del schema `public`. Las tablas
-- ventas, cajas y despachos tenían vendedor_id → auth.users(id), que está en
-- el schema `auth` (opaco para PostgREST). Las queries con
-- `profiles!ventas_vendedor_id_fkey(full_name)` fallan porque PostgREST no
-- puede deducir el camino auth.users → profiles.
--
-- Fix: cambiar las FKs de vendedor_id (y usuario_id) para que apunten a
-- public.profiles(id). Los UUIDs son idénticos (profiles.id = auth.users.id),
-- por lo que la integridad referencial se conserva igual.

-- =====================================================================
-- ventas.vendedor_id
-- =====================================================================
alter table public.ventas
  drop constraint if exists ventas_vendedor_id_fkey,
  add  constraint ventas_vendedor_id_fkey
       foreign key (vendedor_id) references public.profiles(id);

-- =====================================================================
-- cajas.vendedor_id
-- =====================================================================
alter table public.cajas
  drop constraint if exists cajas_vendedor_id_fkey,
  add  constraint cajas_vendedor_id_fkey
       foreign key (vendedor_id) references public.profiles(id);

-- =====================================================================
-- despachos.vendedor_id
-- =====================================================================
alter table public.despachos
  drop constraint if exists despachos_vendedor_id_fkey,
  add  constraint despachos_vendedor_id_fkey
       foreign key (vendedor_id) references public.profiles(id);

-- =====================================================================
-- movimientos_inventario.usuario_id  (nullable, mismo patrón)
-- =====================================================================
alter table public.movimientos_inventario
  drop constraint if exists movimientos_inventario_usuario_id_fkey,
  add  constraint movimientos_inventario_usuario_id_fkey
       foreign key (usuario_id) references public.profiles(id);

-- =====================================================================
-- pagos_credito.usuario_id  (nullable, mismo patrón)
-- =====================================================================
alter table public.pagos_credito
  drop constraint if exists pagos_credito_usuario_id_fkey,
  add  constraint pagos_credito_usuario_id_fkey
       foreign key (usuario_id) references public.profiles(id);
