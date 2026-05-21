import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@distribuapp/shared/types';

const PUBLIC_PREFIXES = ['/login', '/auth/callback', '/auth/confirm', '/_next', '/api/public'];

function isPublicPath(path: string): boolean {
  if (path === '/') return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path === '/login' || path.startsWith('/login/');
  const isPublic = isPublicPath(path);

  // Helper: redirect preservando las cookies que Supabase pudo haber refrescado.
  const redirectWithCookies = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && !isPublic) {
    return redirectWithCookies('/login', { next: path });
  }

  if (user && isAuthPage) {
    const role = (user.app_metadata?.role as string | undefined) ?? null;
    return redirectWithCookies(
      role === 'vendedor' ? '/dashboard/ventas/nueva' : '/dashboard/inventario',
    );
  }

  if (user && path.startsWith('/dashboard')) {
    const role = (user.app_metadata?.role as string | undefined) ?? null;
    const adminOnly =
      path.startsWith('/dashboard/reportes') || path.startsWith('/dashboard/clientes');
    if (adminOnly && role !== 'admin') {
      return redirectWithCookies('/dashboard/ventas');
    }
  }

  return response;
}
