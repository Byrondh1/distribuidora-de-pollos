-- 0002_auth_profiles.sql
-- Perfiles de usuario ligados a auth.users + roles + PIN hash opcional.

create type public.user_role as enum ('admin', 'vendedor');

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete restrict,
  full_name    text,
  email        citext not null,
  role         public.user_role not null default 'vendedor',
  pin_hash     text,          -- hash opcional para reset desde admin
  pin_set_at   timestamptz,
  activo       boolean not null default true,
  last_login_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles(company_id);
create index profiles_email_idx on public.profiles(email);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Trigger: al crear un usuario en auth.users, crear su profile vacío.
-- El company_id se asigna después vía invitación (set_user_company).
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- set_user_company: asigna company_id + role a un usuario y los inyecta
-- en raw_app_meta_data para que aparezcan como claims del JWT.
-- Solo callable por service role o admin de la misma empresa.
-- =====================================================================
create or replace function public.set_user_company(
  target_user_id uuid,
  target_company_id uuid,
  target_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_company uuid;
begin
  caller_role    := public.current_user_role();
  caller_company := public.current_company_id();

  -- service role bypasea RLS y JWT — permitido siempre.
  if auth.role() = 'service_role' then
    null;
  elsif caller_role = 'admin' and caller_company = target_company_id then
    null;
  else
    raise exception 'No autorizado: solo admin del tenant o service role';
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object(
                                  'company_id', target_company_id::text,
                                  'role', target_role::text
                                )
   where id = target_user_id;

  update public.profiles
     set company_id = target_company_id,
         role = target_role
   where id = target_user_id;
end;
$$;

revoke all on function public.set_user_company(uuid, uuid, public.user_role) from public;
grant execute on function public.set_user_company(uuid, uuid, public.user_role) to authenticated, service_role;
