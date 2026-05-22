import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/role';
import { InventarioClient, type InventarioRow } from './_components/inventario-client';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const role = ctx?.role ?? 'vendedor';

  const { data, error } = await supabase
    .from('productos')
    .select(
      'id, sku, nombre, categoria, unidad, tipo_unidad, precio_base, precio_libra, activo, inventario(stock, stock_minimo, ubicacion)',
    )
    .order('nombre', { ascending: true });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando inventario: {error.message}
      </div>
    );
  }

  const rows: InventarioRow[] = ((data ?? []) as any[]).map((p) => {
    const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      unidad: p.unidad,
      tipo_unidad: (p.tipo_unidad ?? 'unit') as 'unit' | 'weight',
      precio_base: Number(p.precio_base),
      precio_libra: p.precio_libra == null ? null : Number(p.precio_libra),
      activo: p.activo,
      stock: Number(inv?.stock ?? 0),
      stock_minimo: Number(inv?.stock_minimo ?? 0),
      ubicacion: inv?.ubicacion ?? null,
    };
  });

  return <InventarioClient initialRows={rows} role={role} />;
}
