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
} from '@/components/ui/dialog';
import { formatCurrency, cn } from '@/lib/utils';
import type { PedidoListItem, PedidoItem, ProductoOpt } from './pedidos-vendedor-client';

type Metodo = 'efectivo' | 'transferencia' | 'credito';

const METODOS: { value: Metodo; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'credito', label: 'Crédito' },
];

type EditableItem = PedidoItem & { _dirty: boolean; _toDelete?: boolean };

export function EjecutarPedidoDialog({
  pedido,
  productos,
  vendedorId,
  onClose,
  onConfirmed,
}: {
  pedido: PedidoListItem;
  productos: ProductoOpt[];
  vendedorId: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<EditableItem[]>(
    pedido.items.map((i) => ({
      ...i,
      _dirty: false,
    })),
  );
  const [agregando, setAgregando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsVisibles = items.filter((i) => !i._toDelete);
  const total = itemsVisibles.reduce(
    (s, i) => s + (i.cantidad_final ?? i.cantidad_estimada) * i.precio_unitario,
    0,
  );

  const productosDisponibles = productos.filter(
    (p) =>
      !items.some((i) => i.producto_id === p.id && !i._toDelete) &&
      (!busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.sku.toLowerCase().includes(busqueda.toLowerCase())),
  );

  function actualizarCantidad(idx: number, valor: string) {
    setItems((prev) => {
      const copy = [...prev];
      const it = copy[idx];
      if (!it) return prev;
      const num = valor === '' ? null : parseFloat(valor);
      copy[idx] = { ...it, cantidad_final: num == null || isNaN(num) ? null : num, _dirty: true };
      return copy;
    });
  }

  function actualizarPrecio(idx: number, valor: string) {
    setItems((prev) => {
      const copy = [...prev];
      const it = copy[idx];
      if (!it) return prev;
      const num = parseFloat(valor) || 0;
      copy[idx] = { ...it, precio_unitario: num, _dirty: true };
      return copy;
    });
  }

  function eliminarItem(idx: number) {
    setItems((prev) => {
      const copy = [...prev];
      const it = copy[idx];
      if (!it) return prev;
      copy[idx] = { ...it, _toDelete: true, _dirty: true };
      return copy;
    });
  }

  function agregarProducto(p: ProductoOpt) {
    const precio = p.tipo_unidad === 'weight' ? p.precio_libra ?? 0 : p.precio_base;
    const nuevoItem: EditableItem = {
      id: `new-${crypto.randomUUID()}`,
      producto_id: p.id,
      producto_sku: p.sku,
      producto_nombre: p.nombre,
      tipo_unidad: p.tipo_unidad,
      unidad: p.tipo_unidad === 'weight' ? 'lb' : p.unidad,
      cantidad_estimada: 1,
      cantidad_final: 1,
      precio_unitario: precio,
      stock_actual: p.stock,
      notas: null,
      _dirty: true,
    };
    setItems((prev) => [...prev, nuevoItem]);
    setAgregando(false);
    setBusqueda('');
  }

  async function persistirCambios(): Promise<void> {
    // Eliminaciones
    const toDelete = items.filter((i) => i._toDelete && !i.id.startsWith('new-')).map((i) => i.id);
    if (toDelete.length > 0) {
      const { error: errD } = await supabase.from('pedido_items').delete().in('id', toDelete);
      if (errD) throw new Error(`Borrar ítems: ${errD.message}`);
    }

    // Inserts (ítems nuevos no marcados para borrar)
    const toInsert = items
      .filter((i) => i.id.startsWith('new-') && !i._toDelete)
      .map((i) => ({
        pedido_id: pedido.id,
        company_id: undefined as unknown as string, // se llena abajo
        producto_id: i.producto_id,
        cantidad_estimada: i.cantidad_estimada,
        cantidad_final: i.cantidad_final,
        precio_unitario: i.precio_unitario,
      }));
    if (toInsert.length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const companyId = user?.app_metadata?.company_id as string | undefined;
      if (!companyId) throw new Error('Sesión inválida');
      const payload = toInsert.map((p) => ({ ...p, company_id: companyId }));
      const { error: errI } = await supabase.from('pedido_items').insert(payload as any);
      if (errI) throw new Error(`Insertar ítems: ${errI.message}`);
    }

    // Updates (existentes con _dirty y no borrados)
    const toUpdate = items.filter(
      (i) => i._dirty && !i._toDelete && !i.id.startsWith('new-'),
    );
    for (const it of toUpdate) {
      const { error: errU } = await supabase
        .from('pedido_items')
        .update({
          cantidad_final: it.cantidad_final,
          precio_unitario: it.precio_unitario,
        } as any)
        .eq('id', it.id);
      if (errU) throw new Error(`Actualizar ítem: ${errU.message}`);
    }
  }

  async function confirmar() {
    setError(null);
    if (itemsVisibles.length === 0) {
      setError('Agrega al menos un producto antes de confirmar.');
      return;
    }
    const sinPrecio = itemsVisibles.find(
      (i) =>
        (i.cantidad_final ?? i.cantidad_estimada) > 0 &&
        (!i.precio_unitario || i.precio_unitario <= 0),
    );
    if (sinPrecio) {
      setError(`"${sinPrecio.producto_nombre}" necesita un precio mayor a 0.`);
      return;
    }
    setSubmitting(true);
    try {
      await persistirCambios();
      const { error: errC } = await supabase.rpc('confirmar_pedido' as any, {
        p_pedido_id: pedido.id,
        p_metodo_pago: metodo,
      } as any);
      if (errC) throw new Error(errC.message);
      onConfirmed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelar() {
    if (!confirm('¿Cancelar este pedido? No se podrá entregar.')) return;
    const motivo = prompt('Motivo (opcional):') ?? '';
    setSubmitting(true);
    try {
      const { error: errC } = await supabase.rpc('cancelar_pedido' as any, {
        p_pedido_id: pedido.id,
        p_motivo: motivo || null,
      } as any);
      if (errC) throw new Error(errC.message);
      onConfirmed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pedido — {pedido.cliente_nombre}</DialogTitle>
          <DialogDescription>
            Entrega: {pedido.fecha_entrega} · Edita cantidades, agrega o elimina productos antes
            de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Ítems</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAgregando((s) => !s)}
                disabled={submitting}
              >
                {agregando ? 'Cerrar' : '+ Agregar producto'}
              </Button>
            </div>

            {agregando && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                <Input
                  placeholder="Buscar producto por nombre o SKU…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <ul className="max-h-48 divide-y overflow-y-auto rounded-md border bg-background">
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
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      Sin productos disponibles
                    </li>
                  )}
                </ul>
              </div>
            )}

            <ul className="divide-y rounded-md border">
              {items.map((it, idx) => {
                if (it._toDelete) {
                  return (
                    <li
                      key={it.id}
                      className="flex items-center justify-between bg-destructive/5 px-3 py-2 text-xs text-muted-foreground line-through"
                    >
                      <span>
                        {it.producto_nombre} ({it.cantidad_estimada}{' '}
                        {it.tipo_unidad === 'weight' ? 'lb' : it.unidad})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => {
                            const copy = [...prev];
                            const item = copy[idx];
                            if (!item) return prev;
                            copy[idx] = { ...item, _toDelete: false, _dirty: true };
                            return copy;
                          })
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        deshacer
                      </button>
                    </li>
                  );
                }
                const cantidadActual = it.cantidad_final ?? it.cantidad_estimada;
                const subtotal = cantidadActual * it.precio_unitario;
                const sufijo = it.tipo_unidad === 'weight' ? 'lb' : it.unidad;
                return (
                  <li key={it.id} className="space-y-2 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {it.producto_nombre}
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[9px] font-medium uppercase',
                              it.tipo_unidad === 'weight'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-900',
                            )}
                          >
                            {it.tipo_unidad === 'weight' ? 'Libra' : 'Unidad'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Estimado: {it.cantidad_estimada.toFixed(2)} {sufijo} · Stock{' '}
                          {it.stock_actual.toFixed(2)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarItem(idx)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          {it.tipo_unidad === 'weight' ? 'Libras reales' : 'Cantidad final'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={it.cantidad_final ?? ''}
                          onChange={(e) => actualizarCantidad(idx, e.target.value)}
                          placeholder={String(it.cantidad_estimada)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          {it.tipo_unidad === 'weight' ? 'Precio /lb' : 'Precio /unidad'}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={it.precio_unitario}
                          onChange={(e) => actualizarPrecio(idx, e.target.value)}
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
            </ul>
          </section>

          <section className="space-y-2">
            <Label className="text-sm">Método de pago</Label>
            <div className="grid grid-cols-3 gap-2">
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

          <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={cancelar}
              disabled={submitting}
              className="text-destructive"
            >
              Cancelar pedido
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cerrar
              </Button>
              <Button onClick={confirmar} disabled={submitting || itemsVisibles.length === 0}>
                {submitting ? 'Procesando…' : 'Confirmar entrega'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
