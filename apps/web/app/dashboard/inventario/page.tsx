import { createClient } from '@/lib/supabase/server';
import { InventarioClient, type InventarioRow } from './_components/inventario-client';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('productos')
    .select(
      'id, sku, nombre, categoria, unidad, precio_base, activo, inventario(stock, stock_minimo, ubicacion)',
    )
    .order('nombre', { ascending: true });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando inventario: {error.message}
      </div>
    );
  }

  const rows: InventarioRow[] = (data ?? []).map((p) => {
    const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      unidad: p.unidad,
      precio_base: Number(p.precio_base),
      activo: p.activo,
      stock: Number(inv?.stock ?? 0),
      stock_minimo: Number(inv?.stock_minimo ?? 0),
      ubicacion: inv?.ubicacion ?? null,
    };
  });

  return <InventarioClient initialRows={rows} />;
}
