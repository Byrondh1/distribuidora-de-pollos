import { createClient } from '@/lib/supabase/server';
import { VentasClient } from './_components/ventas-client';

export const dynamic = 'force-dynamic';

export default async function VentasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id, fecha, total, subtotal, descuento,
      metodo_pago, estado, notas, created_at,
      clientes(nombre),
      profiles!ventas_vendedor_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando ventas: {error.message}
      </div>
    );
  }

  return <VentasClient initialRows={data ?? []} />;
}
