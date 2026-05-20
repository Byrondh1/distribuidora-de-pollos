import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './_components/logout-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, company_id, companies(nombre)')
    .eq('id', user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard/inventario" className="font-semibold">
              DistribuApp
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/dashboard/inventario" className="hover:text-foreground">
                Inventario
              </Link>
              <Link href="/dashboard/clientes" className="hover:text-foreground">
                Clientes
              </Link>
              <Link href="/dashboard/ventas" className="hover:text-foreground">
                Ventas
              </Link>
              <Link href="/dashboard/caja" className="hover:text-foreground">
                Caja
              </Link>
              <Link href="/dashboard/cobranza" className="hover:text-foreground">
                Cobranza
              </Link>
              <Link href="/dashboard/despacho" className="hover:text-foreground">
                Despacho
              </Link>
              <Link href="/dashboard/reportes" className="hover:text-foreground">
                Reportes
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="font-medium">{profile?.full_name ?? user.email}</div>
              <div className="text-xs text-muted-foreground">
                {profile?.companies?.nombre ?? '—'} · {profile?.role ?? '—'}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
