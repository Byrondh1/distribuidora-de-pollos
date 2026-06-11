import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/role';
import { VentasClient } from './_components/ventas-client';

export const dynamic = 'force-dynamic';

export default async function VentasPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const role = ctx?.role ?? 'vendedor';
  // Últimos 30 días por defecto: evita cargar el histórico completo.
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id, fecha, total, subtotal, descuento,
      metodo_pago, estado, notas, created_at,
      clientes(nombre),
      profiles!ventas_vendedor_id_fkey(full_name)
    `)
    .gte('fecha', desde)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando ventas: {error.message}
      </div>
    );
  }

  return <VentasClient initialRows={data ?? []} role={role} />;
}
