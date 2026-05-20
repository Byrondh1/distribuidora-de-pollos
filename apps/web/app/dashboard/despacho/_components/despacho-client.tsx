'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type VentaSinDespacho = {
  id: string;
  total: number;
  fecha: string;
  vendedor_id: string;
  clientes: { nombre: string } | null;
  profiles: { full_name: string | null } | null;
};

type DespachoItem = {
  id: string;
  estado: 'pendiente' | 'entregado' | 'fallido';
  notas: string | null;
  entregado_at: string | null;
  cantidad: number | null;
  ventas: { id: string; total: number; clientes: { nombre: string } | null; fecha: string } | null;
  productos: { sku: string; nombre: string; unidad: string } | null;
};

type Despacho = {
  id: string;
  fecha: string;
  estado: 'pendiente' | 'en_ruta' | 'entregado' | 'fallido';
  notas: string | null;
  vendedor_id: string;
  profiles: { full_name: string | null } | null;
  despacho_items: DespachoItem[];
};

type Vendedor = { id: string; full_name: string | null };
type Producto = { id: string; sku: string; nombre: string; unidad: string; stock: number };

const ESTADO_DESPACHO: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  en_ruta:   'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
  fallido:   'bg-red-100 text-red-700',
};

export function DespachoClient({
  initialDespachos,
  ventasSinDespacho,
  vendedores,
  productos,
  fecha,
}: {
  initialDespachos: Despacho[];
  ventasSinDespacho: VentaSinDespacho[];
  vendedores: Vendedor[];
  productos: Producto[];
  fecha: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [despachos, setDespachos] = useState(initialDespachos);
  const [openNuevo, setOpenNuevo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Estado del diálogo de creación.
  const [modo, setModo] = useState<'productos' | 'ventas'>('productos');
  const [vendedorId, setVendedorId] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [ventasSel, setVentasSel] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);

  function resetForm() {
    setVendedorId('');
    setNotas('');
    setCantidades({});
    setVentasSel(new Set());
    setModo('productos');
  }

  async function crearDespacho() {
    if (!vendedorId) {
      alert('Selecciona un vendedor');
      return;
    }

    if (modo === 'productos') {
      const items = Object.entries(cantidades)
        .map(([producto_id, qty]) => ({ producto_id, cantidad: Number(qty) }))
        .filter((i) => i.cantidad > 0);
      if (items.length === 0) {
        alert('Agrega al menos un producto con cantidad mayor a 0');
        return;
      }
      await guardarConItems({ tipo: 'productos', items });
    } else {
      if (ventasSel.size === 0) {
        alert('Selecciona al menos una venta');
        return;
      }
      await guardarConItems({ tipo: 'ventas', items: [...ventasSel] });
    }
  }

  async function guardarConItems(
    payload:
      | { tipo: 'productos'; items: { producto_id: string; cantidad: number }[] }
      | { tipo: 'ventas'; items: string[] },
  ) {
    setCreando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;
    if (!companyId) {
      alert('No se pudo determinar la empresa.');
      setCreando(false);
      return;
    }

    const { data: despacho, error: errD } = await supabase
      .from('despachos')
      .insert({ company_id: companyId, vendedor_id: vendedorId, fecha, notas: notas || null })
      .select('id')
      .single();
    if (errD || !despacho) {
      alert(errD?.message ?? 'No se pudo crear el despacho');
      setCreando(false);
      return;
    }

    const rows =
      payload.tipo === 'productos'
        ? payload.items.map((i) => ({
            despacho_id: despacho.id,
            company_id: companyId,
            producto_id: i.producto_id,
            cantidad: i.cantidad,
          }))
        : payload.items.map((venta_id) => ({
            despacho_id: despacho.id,
            company_id: companyId,
            venta_id,
          }));

    const { error: errI } = await supabase.from('despacho_items').insert(rows);
    if (errI) {
      alert(errI.message);
      setCreando(false);
      return;
    }

    resetForm();
    setOpenNuevo(false);
    setCreando(false);
    router.refresh();
  }

  async function cambiarEstadoItem(
    despachoId: string,
    itemId: string,
    estado: 'entregado' | 'fallido',
  ) {
    setBusy(itemId);
    const { error } = await supabase.rpc('marcar_despacho_item', {
      p_item_id: itemId,
      p_estado: estado,
    });
    setBusy(null);
    if (error) {
      alert(error.message);
      return;
    }
    setDespachos((prev) =>
      prev.map((d) =>
        d.id !== despachoId
          ? d
          : {
              ...d,
              despacho_items: d.despacho_items.map((i) =>
                i.id === itemId ? { ...i, estado } : i,
              ),
            },
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Despacho</h1>
          <p className="text-sm text-muted-foreground">
            {fecha} · {despachos.length} rutas · {ventasSinDespacho.length} ventas sin asignar
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            Actualizar
          </Button>
          <Dialog
            open={openNuevo}
            onOpenChange={(o) => {
              setOpenNuevo(o);
              if (!o) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>Nuevo despacho</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear despacho</DialogTitle>
                <DialogDescription>
                  Asigna productos (o ventas confirmadas) a un vendedor para entregar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="vendedor">Vendedor</Label>
                  <select
                    id="vendedor"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vendedorId}
                    onChange={(e) => setVendedorId(e.target.value)}
                  >
                    <option value="">Selecciona un vendedor…</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name ?? v.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 border-b">
                  <button
                    type="button"
                    onClick={() => setModo('productos')}
                    className={`px-3 py-2 text-sm font-medium ${
                      modo === 'productos'
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Por productos
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('ventas')}
                    disabled={ventasSinDespacho.length === 0}
                    className={`px-3 py-2 text-sm font-medium disabled:opacity-40 ${
                      modo === 'ventas'
                        ? 'border-b-2 border-primary text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Desde ventas confirmadas ({ventasSinDespacho.length})
                  </button>
                </div>

                {modo === 'productos' ? (
                  <div className="max-h-80 overflow-y-auto rounded-md border">
                    {productos.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        No hay productos activos.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Producto</th>
                            <th className="px-3 py-2 text-right font-medium">Stock</th>
                            <th className="px-3 py-2 text-right font-medium w-32">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {productos.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2">
                                <div className="font-medium">{p.nombre}</div>
                                <div className="text-xs text-muted-foreground">{p.sku}</div>
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {p.stock.toFixed(2)} {p.unidad}
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0"
                                  value={cantidades[p.id] ?? ''}
                                  onChange={(e) =>
                                    setCantidades((prev) => ({
                                      ...prev,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  className="text-right"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {ventasSinDespacho.map((v) => (
                      <label
                        key={v.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={ventasSel.has(v.id)}
                          onChange={(e) => {
                            const next = new Set(ventasSel);
                            if (e.target.checked) next.add(v.id);
                            else next.delete(v.id);
                            setVentasSel(next);
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{v.clientes?.nombre ?? 'Sin cliente'}</div>
                          <div className="text-xs text-muted-foreground">
                            {v.profiles?.full_name ?? '—'} · {formatCurrency(Number(v.total))}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div>
                  <Label htmlFor="notas">Notas (opcional)</Label>
                  <Input
                    id="notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ruta, horario, observaciones…"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenNuevo(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={crearDespacho} disabled={creando}>
                  {creando ? 'Creando…' : 'Crear despacho'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {despachos.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay despachos para hoy.</p>
      )}

      <div className="space-y-4">
        {despachos.map((d) => {
          const entregados = d.despacho_items.filter((i) => i.estado === 'entregado').length;
          const total = d.despacho_items.reduce(
            (s, i) => s + Number(i.ventas?.total ?? 0),
            0,
          );
          return (
            <div key={d.id} className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                <div>
                  <span className="font-semibold">
                    {d.profiles?.full_name ?? d.vendedor_id.slice(0, 8)}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {entregados}/{d.despacho_items.length} entregados
                    {total > 0 && ` · ${formatCurrency(total)}`}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ESTADO_DESPACHO[d.estado] ?? ''
                  }`}
                >
                  {d.estado.replace('_', ' ')}
                </span>
              </div>
              <div className="divide-y">
                {d.despacho_items.map((item) => {
                  const esVenta = !!item.ventas;
                  return (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="font-medium">
                          {esVenta
                            ? item.ventas?.clientes?.nombre ?? 'Sin cliente'
                            : item.productos?.nombre ?? 'Producto'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {esVenta ? (
                            formatCurrency(Number(item.ventas?.total ?? 0))
                          ) : (
                            <>
                              {Number(item.cantidad ?? 0).toFixed(2)} {item.productos?.unidad}
                              {' · '}
                              <span className="text-xs">{item.productos?.sku}</span>
                            </>
                          )}
                          {item.entregado_at && (
                            <span className="ml-2">
                              ·{' '}
                              {new Date(item.entregado_at).toLocaleTimeString('es-PE', {
                                timeStyle: 'short',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.estado === 'pendiente' ? (
                          <>
                            <Button
                              size="sm"
                              disabled={busy === item.id}
                              onClick={() => cambiarEstadoItem(d.id, item.id, 'entregado')}
                            >
                              {busy === item.id ? '…' : 'Entregado'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === item.id}
                              onClick={() => cambiarEstadoItem(d.id, item.id, 'fallido')}
                            >
                              Fallido
                            </Button>
                          </>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              ESTADO_DESPACHO[item.estado] ?? ''
                            }`}
                          >
                            {item.estado}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
