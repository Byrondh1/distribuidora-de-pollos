'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, cn } from '@/lib/utils';

export type ProductoOpt = {
  id: string;
  sku: string;
  nombre: string;
  precio_base: number;
  unidad: string;
  stock: number;
};

export type ClienteOpt = { id: string; nombre: string };

type Item = {
  producto_id: string;
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
};

type Metodo = 'efectivo' | 'transferencia' | 'credito';

const METODOS: { value: Metodo; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'credito', label: 'Crédito' },
];

export function NuevaVentaClient({
  productos,
  clientes,
}: {
  productos: ProductoOpt[];
  clientes: ClienteOpt[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<'items' | 'resumen'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [busquedaCli, setBusquedaCli] = useState('');
  const [cliente, setCliente] = useState<ClienteOpt | null>(null);
  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productosFiltrados = productos.filter(
    (p) =>
      !busquedaProd ||
      p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
      p.sku.toLowerCase().includes(busquedaProd.toLowerCase()),
  );

  const clientesFiltrados = clientes.filter(
    (c) => !busquedaCli || c.nombre.toLowerCase().includes(busquedaCli.toLowerCase()),
  );

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.max(0, subtotal - descuento);

  async function getPrecio(productoId: string, base: number) {
    if (!cliente) return base;
    const { data } = await supabase.rpc('precio_efectivo', {
      p_cliente_id: cliente.id,
      p_producto_id: productoId,
    });
    return Number(data ?? base);
  }

  async function agregar(producto: ProductoOpt, qty: number) {
    if (!qty || qty <= 0) return;
    if (qty > producto.stock) {
      alert(`Stock insuficiente. Disponible: ${producto.stock.toFixed(2)} ${producto.unidad}`);
      return;
    }
    const precio = await getPrecio(producto.id, producto.precio_base);
    setItems((prev) => {
      const existing = prev.find((i) => i.producto_id === producto.id);
      if (existing) {
        return prev.map((i) =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + qty } : i,
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          sku: producto.sku,
          nombre: producto.nombre,
          unidad: producto.unidad,
          cantidad: qty,
          precio_unitario: precio,
        },
      ];
    });
  }

  function quitar(productoId: string) {
    setItems((prev) => prev.filter((i) => i.producto_id !== productoId));
  }

  async function confirmar() {
    setError(null);
    if (items.length === 0) {
      setError('Agrega al menos un producto.');
      setTab('items');
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const companyId = user?.app_metadata?.company_id as string | undefined;
      if (!user || !companyId) throw new Error('Sesión inválida');

      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .insert({
          company_id: companyId,
          vendedor_id: user.id,
          cliente_id: cliente?.id ?? null,
          fecha: new Date().toISOString().slice(0, 10),
          metodo_pago: metodo,
          descuento,
        })
        .select('id')
        .single();
      if (errV || !venta) throw new Error(errV?.message ?? 'No se pudo crear la venta');

      const itemsPayload = items.map((i) => ({
        venta_id: venta.id,
        company_id: companyId,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }));
      const { error: errI } = await supabase.from('venta_items').insert(itemsPayload);
      if (errI) throw new Error(errI.message);

      const { error: errC } = await supabase.rpc('confirmar_venta', { p_venta_id: venta.id });
      if (errC) throw new Error(errC.message);

      router.push('/dashboard/ventas');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Nueva venta</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} producto{items.length === 1 ? '' : 's'} · {formatCurrency(total)}
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <TabButton active={tab === 'items'} onClick={() => setTab('items')}>
          Productos ({items.length})
        </TabButton>
        <TabButton active={tab === 'resumen'} onClick={() => setTab('resumen')}>
          Resumen
        </TabButton>
      </div>

      {tab === 'items' && (
        <div className="space-y-3">
          <Input
            placeholder="Buscar producto por nombre o SKU…"
            value={busquedaProd}
            onChange={(e) => setBusquedaProd(e.target.value)}
            className="max-w-md"
          />
          <ul className="divide-y rounded-lg border">
            {productosFiltrados.map((p) => (
              <ProductoRow
                key={p.id}
                producto={p}
                enCarrito={items.find((i) => i.producto_id === p.id)?.cantidad}
                onAgregar={(qty) => agregar(p, qty)}
                onQuitar={() => quitar(p.id)}
              />
            ))}
            {productosFiltrados.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin productos
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === 'resumen' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-lg border p-4">
              <Label>Cliente</Label>
              {cliente ? (
                <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <span className="font-medium">{cliente.nombre}</span>
                  <Button variant="ghost" size="sm" onClick={() => setCliente(null)}>
                    Quitar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar cliente…"
                    value={busquedaCli}
                    onChange={(e) => setBusquedaCli(e.target.value)}
                    className="mt-2"
                  />
                  {busquedaCli && (
                    <ul className="mt-2 max-h-48 divide-y overflow-y-auto rounded-md border">
                      {clientesFiltrados.slice(0, 10).map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setCliente(c);
                              setBusquedaCli('');
                            }}
                          >
                            {c.nombre}
                          </button>
                        </li>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
                      )}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Opcional · Si no eliges cliente, será venta al contado.
                  </p>
                </>
              )}
            </section>

            <section className="rounded-lg border p-4">
              <Label>Método de pago</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {METODOS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMetodo(m.value)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium',
                      metodo === m.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border">
              <header className="border-b px-4 py-2 text-sm font-medium">
                Ítems ({items.length})
              </header>
              <ul className="divide-y">
                {items.map((i) => (
                  <li key={i.producto_id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium">{i.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.cantidad.toFixed(2)} {i.unidad} ×{' '}
                        {formatCurrency(i.precio_unitario)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {formatCurrency(i.cantidad * i.precio_unitario)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => quitar(i.producto_id)}>
                        ✕
                      </Button>
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No hay productos. Vuelve a la pestaña Productos.
                  </li>
                )}
              </ul>
            </section>
          </div>

          <aside className="space-y-3 rounded-lg border p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Descuento</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={String(descuento)}
                onChange={(e) => setDescuento(parseFloat(e.target.value) || 0)}
                className="h-8 w-28 text-right"
              />
            </div>
            <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <Button className="w-full" disabled={submitting} onClick={confirmar}>
              {submitting ? 'Procesando…' : 'Confirmar venta'}
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-sm font-medium border-b-2 -mb-px',
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ProductoRow({
  producto,
  enCarrito,
  onAgregar,
  onQuitar,
}: {
  producto: ProductoOpt;
  enCarrito?: number;
  onAgregar: (qty: number) => void;
  onQuitar: () => void;
}) {
  const [qty, setQty] = useState('1');
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium">{producto.nombre}</div>
        <div className="text-xs text-muted-foreground">
          {producto.sku} · Stock {producto.stock.toFixed(2)} {producto.unidad} ·{' '}
          {formatCurrency(producto.precio_base)}
        </div>
        {enCarrito !== undefined && (
          <div className="text-xs text-primary">En carrito: {enCarrito.toFixed(2)}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-9 w-20 text-right"
        />
        <Button size="sm" onClick={() => onAgregar(parseFloat(qty) || 0)}>
          Agregar
        </Button>
        {enCarrito !== undefined && (
          <Button size="sm" variant="outline" onClick={onQuitar}>
            ✕
          </Button>
        )}
      </div>
    </li>
  );
}
