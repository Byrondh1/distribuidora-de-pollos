import { createClient } from '@/lib/supabase/server';
import { DespachoClient } from './_components/despacho-client';

export const dynamic = 'force-dynamic';

export default async function DespachoPage() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const [{ data: despachos, error }, { data: ventasSinDespacho }] = await Promise.all([
    supabase
      .from('despachos')
      .select(`
        id, fecha, estado, notas, vendedor_id,
        profiles!despachos_vendedor_id_fkey(full_name),
        despacho_items(
          id, estado, notas, entregado_at,
          ventas(id, total, clientes(nombre), fecha)
        )
      `)
      .eq('fecha', hoy)
      .order('created_at', { ascending: false }),
    // Ventas confirmadas de hoy sin despacho asignado.
    supabase
      .from('ventas')
      .select('id, total, fecha, clientes(nombre), profiles!ventas_vendedor_id_fkey(full_name)')
      .eq('fecha', hoy)
      .eq('estado', 'confirmada')
      .is('despacho_items.despacho_id', null)
      .not('id', 'in', `(select venta_id from despacho_items)`),
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
      initialDespachos={despachos ?? []}
      ventasSinDespacho={ventasSinDespacho ?? []}
      fecha={hoy}
    />
  );
}
