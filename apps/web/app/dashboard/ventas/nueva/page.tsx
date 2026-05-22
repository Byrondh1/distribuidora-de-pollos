import { createClient } from '@/lib/supabase/server';
import { NuevaVentaClient, type ProductoOpt, type ClienteOpt } from './_components/nueva-venta-client';

export const dynamic = 'force-dynamic';

export default async function NuevaVentaPage() {
  const supabase = await createClient();

  const [{ data: productos }, { data: clientes }] = await Promise.all([
    supabase
      .from('productos')
      .select(
        'id, sku, nombre, precio_base, precio_libra, tipo_unidad, unidad, inventario(stock)',
      )
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('clientes')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
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

  const clientesOpt: ClienteOpt[] = ((clientes ?? []) as any[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
  }));

  return <NuevaVentaClient productos={productosOpt} clientes={clientesOpt} />;
}
