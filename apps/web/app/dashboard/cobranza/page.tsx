import { createClient } from '@/lib/supabase/server';
import { CobranzaClient } from './_components/cobranza-client';

export const dynamic = 'force-dynamic';

export default async function CobranzaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creditos')
    .select(`
      id, monto_original, saldo_pendiente, fecha_emision,
      fecha_vencimiento, estado, notas,
      clientes(id, nombre, telefono),
      ventas(id, fecha, metodo_pago)
    `)
    .neq('estado', 'pagado')
    .order('fecha_vencimiento', { ascending: true });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando cobranza: {error.message}
      </div>
    );
  }

  return <CobranzaClient initialRows={data ?? []} />;
}
