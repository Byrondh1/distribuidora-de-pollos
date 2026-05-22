import { createClient } from '@/lib/supabase/server';
import { NuevaVentaClient, type ProductoOpt, type ClienteOpt } from './_components/nueva-venta-client';

export const dynamic = 'force-dynamic';

export default async function NuevaVentaPage() {
  const supabase = await createClient();

  const [{ data: productos }, { data: clientes }, { data: top }] = await Promise.all([
    supabase
      .from('productos')
      .select(
        'id, sku, nombre, precio_base, precio_libra, tipo_unidad, unidad, inventario(stock)',
      )
      .eq('activo', true)
      .order('nombre'),
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.rpc('productos_mas_vendidos' as any, { p_limit: 8, p_dias: 60 } as any),
  ]);

  const productosOpt: ProductoOpt[] = ((productos ?? []) as any[]).map((p) => {
    const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      precio_base: Number(p.precio_base),
      precio_libra: p.precio_libra == null ? null : Number(p.precio_libra),
      tipo_unidad: (p.tipo_unidad ?? 'unit') as 'unit' | 'weight',
      unidad: p.unidad,
      stock: Number(inv?.stock ?? 0),
    };
  });

  const topIds = ((top ?? []) as any[])
    .map((r) => r.producto_id as string)
    .filter(Boolean);
  const topProductosOpt: ProductoOpt[] = topIds
    .map((id) => productosOpt.find((p) => p.id === id))
    .filter((p): p is ProductoOpt => Boolean(p));

  const clientesOpt: ClienteOpt[] = ((clientes ?? []) as any[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
  }));

  return (
    <NuevaVentaClient
      productos={productosOpt}
      topProductos={topProductosOpt}
      clientes={clientesOpt}
    />
  );
}
