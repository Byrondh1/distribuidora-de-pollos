-- 0016_productos_mas_vendidos.sql
-- RPC para sugerir los productos más vendidos en el flujo de nueva venta.
--
-- security invoker → respeta RLS: admin ve agregación de todo el tenant,
-- vendedor ve solo agregación de sus propias ventas.

create or replace function public.productos_mas_vendidos(
  p_limit int default 8,
  p_dias  int default 60
)
returns table (
  producto_id    uuid,
  veces_vendido  bigint,
  cantidad_total numeric
)
language sql
stable
set search_path = public
as $$
  select vi.producto_id,
         count(*)::bigint                       as veces_vendido,
         sum(vi.cantidad)::numeric              as cantidad_total
    from public.venta_items vi
    join public.ventas v on v.id = vi.venta_id
   where v.estado = 'confirmada'
     and v.fecha >= (current_date - (p_dias || ' days')::interval)::date
   group by vi.producto_id
   order by count(*) desc, sum(vi.cantidad) desc
   limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.productos_mas_vendidos(int, int) from public;
grant execute on function public.productos_mas_vendidos(int, int) to authenticated, service_role;
