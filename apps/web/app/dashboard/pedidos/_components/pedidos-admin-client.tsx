'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { NuevoPedidoDialog } from './nuevo-pedido-dialog';
import type {
  PedidoListItem,
  ClienteOpt,
  ProductoOpt,
  VendedorOpt,
} from './pedidos-vendedor-client';

const ESTADO_LABEL: Record<PedidoListItem['estado'], string> = {
  pendiente: 'Pendiente',
  en_ruta: 'En ruta',
  completado: 'Completado',
  parcial: 'Parcial',
  cancelado: 'Cancelado',
};

const ESTADO_COLOR: Record<PedidoListItem['estado'], string> = {
  pendiente: 'bg-amber-100 text-amber-900 border-amber-300',
  en_ruta: 'bg-blue-100 text-blue-900 border-blue-300',
  completado: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  parcial: 'bg-orange-100 text-orange-900 border-orange-300',
  cancelado: 'bg-muted text-muted-foreground border-border',
};

type FiltroEstado = 'todos' | 'activos' | PedidoListItem['estado'];

export function PedidosAdminClient({
  pedidos,
  clientes,
  productos,
  vendedores,
}: {
  pedidos: PedidoListItem[];
  clientes: ClienteOpt[];
  productos: ProductoOpt[];
  vendedores: VendedorOpt[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroEstado>('activos');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (filtroVendedor !== 'todos' && p.vendedor_id !== filtroVendedor) return false;
      if (filtro === 'todos') return true;
      if (filtro === 'activos') return ['pendiente', 'en_ruta'].includes(p.estado);
      return p.estado === filtro;
    });
  }, [pedidos, filtro, filtroVendedor]);

  // Agrupar por fecha_entrega
  const grupos = useMemo(() => {
    const map = new Map<string, PedidoListItem[]>();
    for (const p of filtrados) {
      const arr = map.get(p.fecha_entrega) ?? [];
      arr.push(p);
      map.set(p.fecha_entrega, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} en total
          </p>
        </div>
        <NuevoPedidoDialog
          clientes={clientes}
          productos={productos}
          vendedores={vendedores}
          onCreated={() => router.refresh()}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['activos', 'todos', 'pendiente', 'en_ruta', 'completado', 'parcial', 'cancelado'] as FiltroEstado[]).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium capitalize',
                filtro === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {f === 'activos'
                ? 'Activos'
                : f === 'todos'
                  ? 'Todos'
                  : ESTADO_LABEL[f as PedidoListItem['estado']]}
            </button>
          ),
        )}
        <select
          value={filtroVendedor}
          onChange={(e) => setFiltroVendedor(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="todos">Todos los vendedores</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
      </div>

      {grupos.length === 0 && (
        <div className="rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground">
          Sin pedidos para este filtro.
        </div>
      )}

      {grupos.map(([fecha, lista]) => (
        <section key={fecha} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Entrega: {fecha}</h2>
          <ul className="space-y-2">
            {lista.map((p) => (
              <li key={p.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.cliente_nombre}</span>
                      <span
                        className={cn(
                          'rounded border px-2 py-0.5 text-[10px] font-medium uppercase',
                          ESTADO_COLOR[p.estado],
                        )}
                      >
                        {ESTADO_LABEL[p.estado]}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Asignado a: <span className="font-medium">{p.vendedor_nombre}</span> ·{' '}
                      {p.items.length} producto{p.items.length === 1 ? '' : 's'} ·{' '}
                      {formatCurrency(
                        p.items.reduce(
                          (s, i) =>
                            s +
                            (i.cantidad_final ?? i.cantidad_estimada) * i.precio_unitario,
                          0,
                        ),
                      )}
                    </div>
                    {p.notas && (
                      <div className="mt-1 text-xs italic text-muted-foreground">{p.notas}</div>
                    )}
                  </div>
                  {(p.estado === 'completado' || p.estado === 'parcial') && p.venta_id && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Venta #{p.venta_id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {p.items.map((it) => (
                    <li key={it.id}>
                      • {it.producto_nombre} —{' '}
                      {(it.cantidad_final ?? it.cantidad_estimada).toFixed(2)}{' '}
                      {it.tipo_unidad === 'weight' ? 'lb' : it.unidad}
                      {it.cantidad_final != null &&
                        it.cantidad_final !== it.cantidad_estimada && (
                          <span className="ml-1 text-orange-600">
                            (estimado {it.cantidad_estimada.toFixed(2)})
                          </span>
                        )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
