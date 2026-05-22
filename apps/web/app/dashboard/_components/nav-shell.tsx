'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import { LogoutButton } from './logout-button';
import { createClient } from '@/lib/supabase/client';

type Href = Route;
type NavItem = { href: Href; label: string; badgeKey?: 'pedidos' };

const NAV_ADMIN: NavItem[] = [
  { href: '/dashboard/inventario', label: 'Inventario' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/ventas', label: 'Ventas' },
  { href: '/dashboard/pedidos', label: 'Pedidos', badgeKey: 'pedidos' },
  { href: '/dashboard/caja', label: 'Caja' },
  { href: '/dashboard/cobranza', label: 'Cobranza' },
  { href: '/dashboard/despacho', label: 'Despacho' },
  { href: '/dashboard/reportes', label: 'Reportes' },
];

const NAV_VENDEDOR: NavItem[] = [
  { href: '/dashboard/ventas/nueva', label: 'Nueva venta' },
  { href: '/dashboard/ventas', label: 'Ventas' },
  { href: '/dashboard/pedidos', label: 'Pedidos', badgeKey: 'pedidos' },
  { href: '/dashboard/inventario', label: 'Inventario' },
  { href: '/dashboard/caja', label: 'Caja' },
  { href: '/dashboard/cobranza', label: 'Cobranza' },
  { href: '/dashboard/despacho', label: 'Despacho' },
];

type AlertaPedido = { id: string; clienteNombre: string; createdAt: number };

export function NavShell({
  role,
  userId,
  userLabel,
  companyLabel,
  children,
}: {
  role: 'admin' | 'vendedor';
  userId: string;
  userLabel: string;
  companyLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const items = role === 'admin' ? NAV_ADMIN : NAV_VENDEDOR;
  const homeHref: Href = role === 'admin' ? '/dashboard/inventario' : '/dashboard/ventas/nueva';

  const [pendingCount, setPendingCount] = useState(0);
  const [alerta, setAlerta] = useState<AlertaPedido | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Carga inicial del contador de pedidos pendientes asignados al vendedor
  // y suscripción realtime para badge + alerta inline.
  useEffect(() => {
    if (role !== 'vendedor' || !userId) return;

    let cancelado = false;

    async function cargarContador() {
      const { count } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('vendedor_id', userId)
        .eq('estado', 'pendiente');
      if (!cancelado) setPendingCount(count ?? 0);
    }
    cargarContador();

    const channel = supabase
      .channel(`pedidos-vendedor-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
          filter: `vendedor_id=eq.${userId}`,
        },
        async (payload) => {
          const nuevo = payload.new as { id: string; cliente_id: string };
          // Buscar nombre del cliente
          const { data: cli } = await supabase
            .from('clientes')
            .select('nombre')
            .eq('id', nuevo.cliente_id)
            .maybeSingle();
          setPendingCount((c) => c + 1);
          setAlerta({
            id: nuevo.id,
            clienteNombre: (cli as any)?.nombre ?? '—',
            createdAt: Date.now(),
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `vendedor_id=eq.${userId}`,
        },
        async () => {
          // Recalcular: pasó a en_ruta/completado/etc → count cambia.
          await cargarContador();
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(channel);
    };
  }, [role, userId, supabase]);

  // Auto-cerrar alerta a los 8s
  useEffect(() => {
    if (!alerta) return;
    const t = setTimeout(() => setAlerta(null), 8000);
    return () => clearTimeout(t);
  }, [alerta]);

  function isActive(href: Href) {
    return href === pathname || pathname.startsWith(href + '/');
  }

  function badgeFor(it: NavItem) {
    if (it.badgeKey === 'pedidos' && role === 'vendedor' && pendingCount > 0) {
      return (
        <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {pendingCount}
        </span>
      );
    }
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2 lg:gap-6">
            <button
              type="button"
              aria-label="Abrir menú"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href={homeHref} className="font-semibold">
              DistribuApp
            </Link>
            <nav className="hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    'flex items-center rounded-md px-2 py-1 hover:bg-muted hover:text-foreground',
                    isActive(it.href) && 'bg-muted text-foreground',
                  )}
                >
                  {it.label}
                  {badgeFor(it)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <div className="font-medium leading-tight">{userLabel}</div>
              <div className="text-xs text-muted-foreground">
                {companyLabel} · {role}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
        {open && (
          <nav className="border-t bg-background lg:hidden">
            <ul className="mx-auto flex max-w-7xl flex-col px-2 py-2">
              {items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center rounded-md px-3 py-2 text-sm hover:bg-muted',
                      isActive(it.href) ? 'bg-muted font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {it.label}
                    {badgeFor(it)}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t pt-2 sm:hidden">
                <div className="px-3 py-1 text-xs text-muted-foreground">
                  {userLabel} · {companyLabel} · {role}
                </div>
              </li>
            </ul>
          </nav>
        )}
      </header>

      {alerta && (
        <div className="border-b border-destructive/40 bg-destructive/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
            <div>
              <span className="font-semibold text-destructive">Nuevo pedido asignado</span>
              <span className="ml-2 text-foreground">Cliente: {alerta.clienteNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAlerta(null);
                  router.push('/dashboard/pedidos');
                }}
                className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground"
              >
                Ver pedido
              </button>
              <button
                type="button"
                aria-label="Cerrar alerta"
                onClick={() => setAlerta(null)}
                className="rounded-md p-1 hover:bg-destructive/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:py-8">{children}</main>
    </div>
  );
}
