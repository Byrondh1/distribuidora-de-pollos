import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/role';
import { CajaClient } from './_components/caja-client';
import { MiCajaClient } from './_components/mi-caja-client';

export const dynamic = 'force-dynamic';

export default async function CajaPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const role = ctx?.role ?? 'vendedor';
  const hoy = new Date().toISOString().slice(0, 10);

  if (role !== 'admin') {
    const { data } = await supabase
      .from('caja_resumen')
      .select('*')
      .eq('vendedor_id', ctx?.user.id ?? '')
      .eq('fecha', hoy)
      .maybeSingle();
    return <MiCajaClient initial={data ?? null} fecha={hoy} />;
  }

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
