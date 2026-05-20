-- 0001_init_tenancy.sql
-- Multi-tenancy base: companies + helpers compartidos.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =====================================================================
-- companies: una fila por empresa cliente (tenant).
-- =====================================================================
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        citext not null unique,
  plan        text not null default 'free' check (plan in ('free','pro','enterprise')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.companies is 'Tenants (empresas distribuidoras). Una fila por cliente del SaaS.';

-- =====================================================================
-- Helpers reutilizables
-- =====================================================================

-- Lee el company_id del JWT (claim app_metadata.company_id).
-- Devuelve null si no hay sesión o claim — las políticas RLS deben tratar
-- ese caso como "sin acceso".
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'company_id'),
      (auth.jwt() ->> 'company_id')
    ),
    ''
  )::uuid;
$$;

-- Lee el role del JWT (admin | vendedor).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (auth.jwt() ->> 'role')
  );
$$;

-- Trigger genérico: actualiza updated_at en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();
