import { createClient } from '@/lib/supabase/server';
import { CajaClient } from './_components/caja-client';

export const dynamic = 'force-dynamic';

export default async function CajaPage() {
  const supabase = await createClient();

  // Arqueo de hoy para todos los vendedores del tenant.
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('caja_resumen')
    .select('*')
    .eq('fecha', hoy)
    .order('fecha', { ascending: false });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando cajas: {error.message}
      </div>
    );
  }

  return <CajaClient rows={data ?? []} fecha={hoy} />;
}
