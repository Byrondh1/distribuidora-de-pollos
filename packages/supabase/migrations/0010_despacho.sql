-- 0010_despacho.sql
-- Despacho: agrupa ventas confirmadas para entrega por el vendedor.

create type public.despacho_estado as enum ('pendiente', 'en_ruta', 'entregado', 'fallido');
create type public.despacho_item_estado as enum ('pendiente', 'entregado', 'fallido');

-- =====================================================================
-- despachos: cabecera (una ruta de entrega por vendedor/día).
-- =====================================================================
create table public.despachos (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  vendedor_id  uuid not null references auth.users(id),
  fecha        date not null default current_date,
  estado       public.despacho_estado not null default 'pendiente',
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index despachos_company_fecha_idx on public.despachos(company_id, fecha desc);
create index despachos_vendedor_idx      on public.despachos(vendedor_id);

create trigger despachos_set_updated_at
  before update on public.despachos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- despacho_items: venta a entregar dentro del despacho.
-- Una venta solo puede estar en un despacho activo a la vez.
-- =====================================================================
create table public.despacho_items (
  id           uuid primary key default gen_random_uuid(),
  despacho_id  uuid not null references public.despachos(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  venta_id     uuid not null references public.ventas(id) on delete restrict,
  estado       public.despacho_item_estado not null default 'pendiente',
  notas        text,
  entregado_at timestamptz,
  unique (venta_id)   -- cada venta aparece en un solo despacho
);

create index despacho_items_despacho_idx on public.despacho_items(despacho_id);
create index despacho_items_company_idx  on public.despacho_items(company_id);

-- =====================================================================
-- marcar_item_entregado / marcar_item_fallido:
-- el vendedor actualiza el estado de cada ítem en ruta.
-- =====================================================================
create or replace function public.marcar_despacho_item(
  p_item_id uuid,
  p_estado  public.despacho_item_estado,
  p_notas   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_despacho_id  uuid;
  v_vendedor_id  uuid;
  v_company      uuid := public.current_company_id();
  v_todos_estado text;
begin
  select di.despacho_id, d.vendedor_id
    into v_despacho_id, v_vendedor_id
    from public.despacho_items di
    join public.despachos d on d.id = di.despacho_id
   where di.id = p_item_id and di.company_id = v_company;

  if not found then raise exception 'Ítem de despacho no encontrado'; end if;

  -- Vendedor solo puede actualizar sus propios despachos.
  if auth.role() <> 'service_role'
     and v_vendedor_id <> auth.uid()
     and public.current_user_role() <> 'admin'
  then
    raise exception 'No autorizado';
  end if;

  update public.despacho_items
     set estado       = p_estado,
         notas        = coalesce(p_notas, notas),
         entregado_at = case when p_estado = 'entregado' then now() else entregado_at end
   where id = p_item_id;

  -- Si todos los ítems están terminados (entregado o fallido), cerrar el despacho.
  select min(estado::text) into v_todos_estado
    from public.despacho_items
   where despacho_id = v_despacho_id
     and estado = 'pendiente';

  if v_todos_estado is null then
    -- No quedan pendientes; determinar estado final del despacho.
    update public.despachos
       set estado = case
         when not exists (
           select 1 from public.despacho_items
            where despacho_id = v_despacho_id and estado = 'fallido'
         ) then 'entregado'
         else 'fallido'
       end
     where id = v_despacho_id;
  elsif (select estado from public.despachos where id = v_despacho_id) = 'pendiente' then
    update public.despachos set estado = 'en_ruta' where id = v_despacho_id;
  end if;
end;
$$;

revoke all on function public.marcar_despacho_item(uuid, public.despacho_item_estado, text) from public;
grant execute on function public.marcar_despacho_item(uuid, public.despacho_item_estado, text) to authenticated;

-- Audit + Realtime
create trigger audit_despachos
  after insert or update or delete on public.despachos
  for each row execute function public.audit_trigger();

alter publication supabase_realtime add table public.despachos;
alter publication supabase_realtime add table public.despacho_items;

-- RLS -----------------------------------------------------------------------
alter table public.despachos      enable row level security;
alter table public.despacho_items enable row level security;

create policy despachos_vendedor_own
  on public.despachos for all to authenticated
  using (company_id = public.current_company_id() and vendedor_id = auth.uid())
  with check (company_id = public.current_company_id() and vendedor_id = auth.uid());

create policy despachos_admin_all
  on public.despachos for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

create policy despacho_items_tenant_select
  on public.despacho_items for select to authenticated
  using (company_id = public.current_company_id());

create policy despacho_items_admin_write
  on public.despacho_items for all to authenticated
  using (company_id = public.current_company_id() and public.current_user_role() = 'admin')
  with check (company_id = public.current_company_id() and public.current_user_role() = 'admin');

create policy despacho_items_vendedor_select
  on public.despacho_items for select to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.despachos d
       where d.id = despacho_id and d.vendedor_id = auth.uid()
    )
  );
