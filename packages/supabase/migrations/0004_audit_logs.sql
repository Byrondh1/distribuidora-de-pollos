-- 0004_audit_logs.sql
-- Bitácora genérica de cambios sobre entidades sensibles.

create table public.audit_logs (
  id           bigserial primary key,
  company_id   uuid,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null check (action in ('INSERT','UPDATE','DELETE')),
  entity_type  text not null,
  entity_id    text,
  before       jsonb,
  after        jsonb,
  created_at   timestamptz not null default now()
);

create index audit_logs_company_created_idx
  on public.audit_logs(company_id, created_at desc);
create index audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id);

-- =====================================================================
-- audit_trigger genérico. Captura OLD/NEW como jsonb y resuelve
-- company_id y user_id desde la fila o el JWT.
-- =====================================================================
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_user    uuid;
  v_before  jsonb;
  v_after   jsonb;
  v_entity_id text;
begin
  v_user := auth.uid();

  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_after  := null;
    v_company := (v_before ->> 'company_id')::uuid;
    v_entity_id := v_before ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
    v_company := coalesce((v_after ->> 'company_id')::uuid, (v_before ->> 'company_id')::uuid);
    v_entity_id := v_after ->> 'id';
  else -- INSERT
    v_before := null;
    v_after  := to_jsonb(new);
    v_company := (v_after ->> 'company_id')::uuid;
    v_entity_id := v_after ->> 'id';
  end if;

  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, before, after)
  values (v_company, v_user, tg_op, tg_table_name, v_entity_id, v_before, v_after);

  return coalesce(new, old);
end;
$$;

-- Aplicar a tablas sensibles.
create trigger audit_productos
  after insert or update or delete on public.productos
  for each row execute function public.audit_trigger();

create trigger audit_inventario
  after insert or update or delete on public.inventario
  for each row execute function public.audit_trigger();

create trigger audit_movimientos
  after insert on public.movimientos_inventario
  for each row execute function public.audit_trigger();

create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();
