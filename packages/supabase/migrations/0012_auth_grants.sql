-- 0012_auth_grants.sql
-- Fix: "Database error querying schema" al hacer login.
--
-- GoTrue (Supabase Auth) corre como el rol `supabase_auth_admin`. Cuando un
-- usuario hace login, GoTrue introspeciona el schema y dispara cualquier
-- trigger registrado en `auth.users`. Nuestro trigger `on_auth_user_created`
-- ejecuta `public.handle_new_user()` que toca `public.profiles`.
--
-- Aunque la función es SECURITY DEFINER (se ejecuta como su owner), el rol
-- llamante necesita permisos BÁSICOS para resolver el nombre de la función,
-- el schema y los tipos personalizados. Sin esos grants, GoTrue falla con
-- "Database error querying schema" sin ejecutar el cuerpo del trigger.

-- 1. Acceso al schema public para introspección.
grant usage on schema public to supabase_auth_admin;

-- 2. Tabla profiles (insert ejecutado por handle_new_user con SECURITY DEFINER,
--    pero el rol llamante igual necesita verla en el catálogo).
grant all on public.profiles to supabase_auth_admin;

-- 3. Funciones disparadas por triggers en auth.users.
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- 4. Tipos enum referenciados en firmas de funciones del schema public.
grant usage on type public.user_role to supabase_auth_admin;

-- 5. Permisos por defecto para objetos futuros creados en public
--    (evita regresiones cuando agregues más triggers o tablas referenciadas).
alter default privileges in schema public
  grant all on tables to supabase_auth_admin;

alter default privileges in schema public
  grant execute on functions to supabase_auth_admin;
