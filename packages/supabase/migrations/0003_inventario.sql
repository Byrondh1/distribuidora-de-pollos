-- 0003_inventario.sql
-- Productos, inventario (stock actual) y movimientos (audit + ajuste atómico).

create type public.movimiento_tipo as enum ('entrada', 'salida', 'ajuste');

-- =====================================================================
-- productos
-- =====================================================================
create table public.productos (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  sku         text not null,
  nombre      text not null,
  categoria   text,
  unidad      text not null default 'unidad',
  precio_base numeric(12,2) not null default 0 check (precio_base >= 0),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, sku)
);

create index productos_company_idx on public.productos(company_id);
create index productos_nombre_trgm_idx on public.productos using gin (nombre gin_trgm_ops);

create extension if not exists pg_trgm;

create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- inventario: stock actual (1:1 con producto por tenant).
-- =====================================================================
create table public.inventario (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  producto_id   uuid not null references public.productos(id) on delete cascade,
  stock         numeric(14,3) not null default 0,
  stock_minimo  numeric(14,3) not null default 0,
  ubicacion     text,
  updated_at    timestamptz not null default now(),
  unique (producto_id)
);

create index inventario_company_idx on public.inventario(company_id);

create trigger inventario_set_updated_at
  before update on public.inventario
  for each row execute function public.set_updated_at();

-- Auto-crear fila de inventario al crear un producto.
create or replace function public.bootstrap_inventario_for_producto()
returns trigger
language plpgsql
as $$
begin
  insert into public.inventario (company_id, producto_id)
  values (new.company_id, new.id)
  on conflict (producto_id) do nothing;
  return new;
end;
$$;

create trigger productos_bootstrap_inventario
  after insert on public.productos
  for each row execute function public.bootstrap_inventario_for_producto();

-- =====================================================================
-- movimientos_inventario: bitácora + motor de ajuste de stock.
-- =====================================================================
create table public.movimientos_inventario (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  producto_id  uuid not null references public.productos(id) on delete restrict,
  tipo         public.movimiento_tipo not null,
  cantidad     numeric(14,3) not null check (cantidad > 0),
  motivo       text,
  usuario_id   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index movimientos_company_created_idx
  on public.movimientos_inventario(company_id, created_at desc);
create index movimientos_producto_idx
  on public.movimientos_inventario(producto_id);

-- Trigger: aplica el movimiento al stock atómicamente.
create or replace function public.aplicar_movimiento_inventario()
returns trigger
language plpgsql
as $$
declare
  delta numeric(14,3);
begin
  delta := case new.tipo
    when 'entrada' then  new.cantidad
    when 'salida'  then -new.cantidad
    when 'ajuste'  then  new.cantidad  -- ajuste: la cantidad firmada por motivo
  end;

  update public.inventario
     set stock = stock + delta
   where producto_id = new.producto_id
     and company_id = new.company_id;

  if not found then
    raise exception 'No existe inventario para producto %', new.producto_id;
  end if;

  return new;
end;
$$;

create trigger movimientos_aplicar
  after insert on public.movimientos_inventario
  for each row execute function public.aplicar_movimiento_inventario();

-- =====================================================================
-- Realtime: exponer cambios en inventario y productos.
-- =====================================================================
alter publication supabase_realtime add table public.inventario;
alter publication supabase_realtime add table public.productos;
alter publication supabase_realtime add table public.movimientos_inventario;
