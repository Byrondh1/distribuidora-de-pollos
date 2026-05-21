import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NavShell } from './_components/nav-shell';

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

  const role: 'admin' | 'vendedor' =
    (profile?.role as 'admin' | 'vendedor' | undefined) ??
    ((user.app_metadata?.role as 'admin' | 'vendedor' | undefined) ?? 'vendedor');

  return (
    <NavShell
      role={role}
      userLabel={profile?.full_name ?? user.email ?? '—'}
      companyLabel={profile?.companies?.nombre ?? '—'}
    >
      {children}
    </NavShell>
  );
}
