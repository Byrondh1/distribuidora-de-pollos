-- 0006_clientes.sql
-- Clientes del tenant + precios personalizados por producto.

create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  nombre      text not null,
  telefono    text,
  email       citext,
  direccion   text,
  ruc         text,                          -- para facturación
  limite_credito numeric(14,2) not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index clientes_company_idx on public.clientes(company_id);
create index clientes_nombre_trgm_idx on public.clientes using gin (nombre gin_trgm_ops);

create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- =====================================================================
-- precios_cliente: precio personalizado por cliente + producto.
-- Si no existe una fila para el par (cliente, producto), se usa precio_base.
-- =====================================================================
create table public.precios_cliente (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio      numeric(12,2) not null check (precio >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cliente_id, producto_id)
);

create index precios_cliente_company_idx on public.precios_cliente(company_id);

create trigger precios_cliente_set_updated_at
  before update on public.precios_cliente
  for each row execute function public.set_updated_at();

-- Función helper: devuelve el precio efectivo para un par cliente/producto.
create or replace function public.precio_efectivo(
  p_cliente_id uuid,
  p_producto_id uuid
)
returns numeric(12,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pc.precio
       from public.precios_cliente pc
      where pc.cliente_id = p_cliente_id
        and pc.producto_id = p_producto_id
      limit 1),
    (select p.precio_base
       from public.productos p
      where p.id = p_producto_id
      limit 1),
    0
  );
$$;

-- Audit
create trigger audit_clientes
  after insert or update or delete on public.clientes
  for each row execute function public.audit_trigger();

create trigger audit_precios_cliente
  after insert or update or delete on public.precios_cliente
  for each row execute function public.audit_trigger();

-- Realtime
alter publication supabase_realtime add table public.clientes;

-- RLS -----------------------------------------------------------------------
alter table public.clientes       enable row level security;
alter table public.precios_cliente enable row level security;

drop policy if exists clientes_tenant_select on public.clientes;
create policy clientes_tenant_select
  on public.clientes for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists clientes_admin_write on public.clientes;
create policy clientes_admin_write
  on public.clientes for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

drop policy if exists clientes_vendedor_insert on public.clientes;
create policy clientes_vendedor_insert
  on public.clientes for insert to authenticated
  with check (company_id = public.current_company_id() and public.current_user_role() = 'vendedor');

drop policy if exists precios_cliente_tenant_select on public.precios_cliente;
create policy precios_cliente_tenant_select
  on public.precios_cliente for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists precios_cliente_admin_write on public.precios_cliente;
create policy precios_cliente_admin_write
  on public.precios_cliente for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');
