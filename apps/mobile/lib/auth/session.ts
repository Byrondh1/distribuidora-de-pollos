import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function getCompanyId(session: Session | null): string | null {
  const meta = session?.user?.app_metadata as Record<string, unknown> | undefined;
  return (meta?.company_id as string | undefined) ?? null;
}

export function getRole(session: Session | null): string | null {
  const meta = session?.user?.app_metadata as Record<string, unknown> | undefined;
  return (meta?.role as string | undefined) ?? null;
}
