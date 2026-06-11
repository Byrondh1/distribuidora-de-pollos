'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatCurrency, cn } from '@/lib/utils';
import type { ClienteOpt, ProductoOpt, VendedorOpt } from './pedidos-vendedor-client';

type ItemDraft = {
  producto: ProductoOpt;
  cantidad: number;
  precio: number;
};

export function NuevoPedidoDialog({
  clientes,
  productos,
  vendedores,
  onCreated,
}: {
  clientes: ClienteOpt[];
  productos: ProductoOpt[];
  vendedores: VendedorOpt[];
  onCreated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [cliente, setCliente] = useState<ClienteOpt | null>(null);
  const [vendedor, setVendedor] = useState<VendedorOpt | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [busquedaCli, setBusquedaCli] = useState('');
  const [busquedaProd, setBusquedaProd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientesFiltrados = clientes.filter(
    (c) => !busquedaCli || c.nombre.toLowerCase().includes(busquedaCli.toLowerCase()),
  );
  const productosDisponibles = productos.filter(
    (p) =>
      !items.some((it) => it.producto.id === p.id) &&
      (!busquedaProd ||
        p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
        p.sku.toLowerCase().includes(busquedaProd.toLowerCase())),
  );

  const total = items.reduce((s, it) => s + it.cantidad * it.precio, 0);

  async function agregarProducto(p: ProductoOpt) {
    let precio = p.tipo_unidad === 'weight' ? p.precio_libra ?? 0 : p.precio_base;
    if (cliente) {
      const { data } = await supabase.rpc('precio_efectivo' as any, {
        p_cliente_id: cliente.id,
        p_producto_id: p.id,
      } as any);
      const custom = Number(data ?? 0);
      if (custom > 0) precio = custom;
    }
    setItems((prev) => [...prev, { producto: p, cantidad: 1, precio }]);
    setBusquedaProd('');
  }

  function reset() {
    setCliente(null);
    setVendedor(null);
    setFechaEntrega(new Date().toISOString().slice(0, 10));
    setNotas('');
    setItems([]);
    setBusquedaCli('');
    setBusquedaProd('');
    setError(null);
  }

  async function crear() {
    setError(null);
    if (!cliente) return setError('Selecciona un cliente.');
    if (!vendedor) return setError('Asigna un vendedor.');
    if (!fechaEntrega) return setError('Fecha de entrega requerida.');
    if (items.length === 0) return setError('Agrega al menos un producto.');
    const sinPrecio = items.find((it) => !it.precio || it.precio <= 0);
    if (sinPrecio) {
      return setError(`"${sinPrecio.producto.nombre}" necesita un precio mayor a 0.`);
    }
    const sinCantidad = items.find((it) => !it.cantidad || it.cantidad <= 0);
    if (sinCantidad) {
      return setError(`"${sinCantidad.producto.nombre}" necesita una cantidad mayor a 0.`);
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const companyId = user?.app_metadata?.company_id as string | undefined;
      if (!user || !companyId) throw new Error('Sesión inválida');

      const { data: pedido, error: errP } = await supabase
        .from('pedidos')
        .insert({
          company_id: companyId,
          cliente_id: cliente.id,
          vendedor_id: vendedor.id,
          creado_por: user.id,
          fecha_entrega: fechaEntrega,
          notas: notas || null,
        } as any)
        .select('id')
        .single();
      if (errP || !pedido) throw new Error(errP?.message ?? 'No se pudo crear el pedido');

      const payload = items.map((it) => ({
        pedido_id: (pedido as any).id,
        company_id: companyId,
        producto_id: it.producto.id,
        cantidad_estimada: it.cantidad,
        precio_unitario: it.precio,
      }));
      const { error: errI } = await supabase.from('pedido_items').insert(payload as any);
      if (errI) throw new Error(errI.message);

      reset();
      setOpen(false);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>+ Nuevo pedido</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo pedido</DialogTitle>
          <DialogDescription>
            Crea un pedido para un cliente y asígnalo a un vendedor. El vendedor recibirá una
            notificación inmediata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-sm">Cliente</Label>
              {cliente ? (
                <div className="mt-1 flex items-center justify-between rounded-md border bg-primary/10 px-3 py-2 text-sm">
                  <span className="font-medium">{cliente.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setCliente(null)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    cambiar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar cliente…"
                    value={busquedaCli}
                    onChange={(e) => setBusquedaCli(e.target.value)}
                    className="mt-1"
                  />
                  {busquedaCli && (
                    <ul className="mt-1 max-h-40 divide-y overflow-y-auto rounded-md border">
                      {clientesFiltrados.slice(0, 10).map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCliente(c);
                              setBusquedaCli('');
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
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
                </>
              )}
            </div>

            <div>
              <Label className="text-sm">Vendedor asignado</Label>
              <select
                value={vendedor?.id ?? ''}
                onChange={(e) => {
                  const v = vendedores.find((x) => x.id === e.target.value) ?? null;
                  setVendedor(v);
                }}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Seleccionar —</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm">Fecha de entrega</Label>
              <Input
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Notas (opcional)</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Llegada antes de 10am"
                className="mt-1"
              />
            </div>
          </div>

          <section className="space-y-2">
            <Label className="text-sm">Productos pedidos</Label>
            <Input
              placeholder="Buscar producto para agregar…"
              value={busquedaProd}
              onChange={(e) => setBusquedaProd(e.target.value)}
            />
            {busquedaProd && (
              <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
                {productosDisponibles.slice(0, 10).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => agregarProducto(p)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{p.nombre}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.tipo_unidad === 'weight' ? 'Por libra' : 'Por unidad'} · Stock{' '}
                        {p.stock.toFixed(2)}
                      </span>
                    </button>
                  </li>
                ))}
                {productosDisponibles.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
                )}
              </ul>
            )}

            <ul className="divide-y rounded-md border">
              {items.map((it, idx) => {
                const esPorPeso = it.producto.tipo_unidad === 'weight';
                const sufijo = esPorPeso ? 'lb' : it.producto.unidad;
                const subtotal = it.cantidad * it.precio;
                return (
                  <li key={it.producto.id} className="space-y-2 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {it.producto.nombre}
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[9px] font-medium uppercase',
                              esPorPeso
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-900',
                            )}
                          >
                            {esPorPeso ? 'Libra' : 'Unidad'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Stock {it.producto.stock.toFixed(2)} {sufijo}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-xs text-destructive hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          {esPorPeso ? 'Libras estimadas' : 'Cantidad'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={it.cantidad}
                          onChange={(e) =>
                            setItems((prev) => {
                              const copy = [...prev];
                              const item = copy[idx];
                              if (!item) return prev;
                              copy[idx] = { ...item, cantidad: parseFloat(e.target.value) || 0 };
                              return copy;
                            })
                          }
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          {esPorPeso ? 'Precio /lb' : 'Precio /unidad'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={it.precio}
                          onChange={(e) =>
                            setItems((prev) => {
                              const copy = [...prev];
                              const item = copy[idx];
                              if (!item) return prev;
                              copy[idx] = { ...item, precio: parseFloat(e.target.value) || 0 };
                              return copy;
                            })
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="text-right">
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          Subtotal
                        </Label>
                        <div className="h-9 pt-2 text-sm font-medium">
                          {formatCurrency(subtotal)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin productos. Busca arriba para agregar.
                </li>
              )}
            </ul>
          </section>

          <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
            <span>Total estimado</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={crear} disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear pedido'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
