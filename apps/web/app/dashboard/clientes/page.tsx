import { createClient } from '@/lib/supabase/server';
import { ClientesClient } from './_components/clientes-client';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, email, ruc, limite_credito, activo')
    .order('nombre', { ascending: true });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error cargando clientes: {error.message}
      </div>
    );
  }

  return <ClientesClient initialRows={data ?? []} />;
}
