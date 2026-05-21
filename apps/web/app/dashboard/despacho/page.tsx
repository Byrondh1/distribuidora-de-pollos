import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/role';
import { DespachoClient } from './_components/despacho-client';

export const dynamic = 'force-dynamic';

export default async function DespachoPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const role = ctx?.role ?? 'vendedor';
  const hoy = new Date().toISOString().slice(0, 10);

  const [
    { data: despachos, error },
    { data: ventasSinDespacho },
    { data: vendedores },
    { data: productos },
  ] = await Promise.all([
    supabase
      .from('despachos')
      .select(`
        id, fecha, estado, notas, vendedor_id,
        profiles!despachos_vendedor_id_fkey(full_name),
        despacho_items(
          id, estado, notas, entregado_at, cantidad,
          ventas(id, total, clientes(nombre), fecha),
          productos(sku, nombre, unidad)
        )
      `)
      .eq('fecha', hoy)
      .order('created_at', { ascending: false }),
    supabase
      .from('ventas')
      .select('id, total, fecha, clientes(nombre), vendedor_id, profiles!ventas_vendedor_id_fkey(full_name)')
      .eq('fecha', hoy)
      .eq('estado', 'confirmada')
      .not('id', 'in', `(select venta_id from despacho_items where venta_id is not null)`),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'vendedor')
      .eq('activo', true)
      .order('full_name'),
    supabase
      .from('productos')
      .select('id, sku, nombre, unidad, inventario(stock)')
      .eq('activo', true)
      .order('nombre'),
  ]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando despachos: {error.message}
      </div>
    );
  }

  return (
    <DespachoClient
      role={role}
      initialDespachos={despachos ?? []}
      ventasSinDespacho={ventasSinDespacho ?? []}
      vendedores={vendedores ?? []}
      productos={(productos ?? []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        nombre: p.nombre,
        unidad: p.unidad,
        stock: Number(
          Array.isArray(p.inventario) ? p.inventario[0]?.stock ?? 0 : p.inventario?.stock ?? 0,
        ),
      }))}
      fecha={hoy}
    />
  );
}
