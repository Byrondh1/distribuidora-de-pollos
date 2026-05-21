'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import { LogoutButton } from './logout-button';

type Href = Route;
type NavItem = { href: Href; label: string };

const NAV_ADMIN: NavItem[] = [
  { href: '/dashboard/inventario', label: 'Inventario' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/ventas', label: 'Ventas' },
  { href: '/dashboard/caja', label: 'Caja' },
  { href: '/dashboard/cobranza', label: 'Cobranza' },
  { href: '/dashboard/despacho', label: 'Despacho' },
  { href: '/dashboard/reportes', label: 'Reportes' },
];

const NAV_VENDEDOR: NavItem[] = [
  { href: '/dashboard/ventas/nueva', label: 'Nueva venta' },
  { href: '/dashboard/ventas', label: 'Ventas' },
  { href: '/dashboard/inventario', label: 'Inventario' },
  { href: '/dashboard/caja', label: 'Caja' },
  { href: '/dashboard/cobranza', label: 'Cobranza' },
  { href: '/dashboard/despacho', label: 'Despacho' },
];

export function NavShell({
  role,
  userLabel,
  companyLabel,
  children,
}: {
  role: 'admin' | 'vendedor';
  userLabel: string;
  companyLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = role === 'admin' ? NAV_ADMIN : NAV_VENDEDOR;
  const homeHref: Href = role === 'admin' ? '/dashboard/inventario' : '/dashboard/ventas/nueva';

  function isActive(href: Href) {
    return href === pathname || pathname.startsWith(href + '/');
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
                    'rounded-md px-2 py-1 hover:bg-muted hover:text-foreground',
                    isActive(it.href) && 'bg-muted text-foreground',
                  )}
                >
                  {it.label}
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
                      'block rounded-md px-3 py-2 text-sm hover:bg-muted',
                      isActive(it.href) ? 'bg-muted font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {it.label}
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:py-8">{children}</main>
    </div>
  );
}
