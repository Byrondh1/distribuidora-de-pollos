-- 0005_rls_policies.sql
-- Row Level Security: aislamiento por tenant + restricciones por rol.

alter table public.companies              enable row level security;
alter table public.profiles               enable row level security;
alter table public.productos              enable row level security;
alter table public.inventario             enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.audit_logs             enable row level security;

-- =====================================================================
-- companies: cada usuario ve solo su empresa.
-- =====================================================================
create policy companies_select_own
  on public.companies for select
  to authenticated
  using (id = public.current_company_id());

create policy companies_update_admin
  on public.companies for update
  to authenticated
  using (id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (id = public.current_company_id());

-- =====================================================================
-- profiles: el usuario ve su propio perfil + admin ve todos los del tenant.
-- =====================================================================
create policy profiles_select_self_or_admin
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  );

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- impedir auto-promoción de rol o cambio de tenant desde cliente
    and role = (select role from public.profiles where id = auth.uid())
    and company_id is not distinct from (select company_id from public.profiles where id = auth.uid())
  );

create policy profiles_admin_manage
  on public.profiles for all
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

-- =====================================================================
-- productos
-- =====================================================================
create policy productos_tenant_select
  on public.productos for select
  to authenticated
  using (company_id = public.current_company_id());

create policy productos_admin_write
  on public.productos for all
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

-- =====================================================================
-- inventario: lectura para ambos roles; escritura directa solo admin.
-- (Los vendedores cambian stock indirectamente vía movimientos_inventario.)
-- =====================================================================
create policy inventario_tenant_select
  on public.inventario for select
  to authenticated
  using (company_id = public.current_company_id());

create policy inventario_admin_write
  on public.inventario for all
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

-- =====================================================================
-- movimientos_inventario:
--   - SELECT: cualquier usuario del tenant.
--   - INSERT vendedor: solo 'salida' (ventas en campo).
--   - INSERT admin: cualquier tipo (entrada, salida, ajuste).
-- =====================================================================
create policy movimientos_tenant_select
  on public.movimientos_inventario for select
  to authenticated
  using (company_id = public.current_company_id());

create policy movimientos_vendedor_insert
  on public.movimientos_inventario for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() = 'vendedor'
    and tipo = 'salida'
    and usuario_id = auth.uid()
  );

create policy movimientos_admin_insert
  on public.movimientos_inventario for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and public.current_user_role() = 'admin'
  );

-- =====================================================================
-- audit_logs: solo lectura para admin del tenant. INSERT via trigger
-- SECURITY DEFINER (no se necesitan policies de insert para usuarios).
-- =====================================================================
create policy audit_logs_admin_select
  on public.audit_logs for select
  to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin');
