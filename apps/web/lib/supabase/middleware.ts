import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@distribuapp/shared/types';

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
  const isAuthPage = path.startsWith('/login');
  const isPublic = isAuthPage || path === '/' || path.startsWith('/_next');

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    const role = (user.app_metadata?.role as string | undefined) ?? null;
    url.pathname = role === 'vendedor' ? '/dashboard/ventas/nueva' : '/dashboard/inventario';
    return NextResponse.redirect(url);
  }

  // Rutas restringidas a admin.
  if (user && path.startsWith('/dashboard')) {
    const role = (user.app_metadata?.role as string | undefined) ?? null;
    const adminOnly =
      path.startsWith('/dashboard/reportes') || path.startsWith('/dashboard/clientes');
    if (adminOnly && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/ventas';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
