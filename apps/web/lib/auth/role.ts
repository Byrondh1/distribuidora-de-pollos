import { createClient } from '@/lib/supabase/server';

export type AppRole = 'admin' | 'vendedor';

export async function getUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = ((user.app_metadata?.role as AppRole | undefined) ?? 'vendedor') as AppRole;
  const companyId = (user.app_metadata?.company_id as string | undefined) ?? null;
  return { user, role, companyId };
}
