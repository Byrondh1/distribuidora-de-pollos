'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { EjecutarPedidoDialog } from './ejecutar-pedido-dialog';

export type ProductoOpt = {
  id: string;
  sku: string;
  nombre: string;
  tipo_unidad: 'unit' | 'weight';
  unidad: string;
  precio_base: number;
  precio_libra: number | null;
  stock: number;
};

export type ClienteOpt = { id: string; nombre: string };
export type VendedorOpt = { id: string; nombre: string };

export type PedidoItem = {
  id: string;
  producto_id: string;
  producto_sku: string;
  producto_nombre: string;
  tipo_unidad: 'unit' | 'weight';
  unidad: string;
  cantidad_estimada: number;
  cantidad_final: number | null;
  precio_unitario: number;
  stock_actual: number;
  notas: string | null;
};

export type PedidoListItem = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  vendedor_id: string;
  vendedor_nombre: string;
  fecha_entrega: string;
  estado: 'pendiente' | 'en_ruta' | 'completado' | 'parcial' | 'cancelado';
  notas: string | null;
  venta_id: string | null;
  created_at: string;
  items: PedidoItem[];
};

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

export function PedidosVendedorClient({
  pedidos: initialPedidos,
  productos,
  vendedorId,
}: {
  pedidos: PedidoListItem[];
  productos: ProductoOpt[];
  vendedorId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [activo, setActivo] = useState<PedidoListItem | null>(null);
  const [filter, setFilter] = useState<'activos' | 'historial'>('activos');

  const activos = initialPedidos.filter((p) =>
    ['pendiente', 'en_ruta'].includes(p.estado),
  );
  const historial = initialPedidos.filter((p) =>
    ['completado', 'parcial', 'cancelado'].includes(p.estado),
  );
  const lista = filter === 'activos' ? activos : historial;

  async function abrirPedido(p: PedidoListItem) {
    if (p.estado === 'pendiente') {
      await supabase.rpc('marcar_pedido_en_ruta' as any, { p_pedido_id: p.id } as any);
      router.refresh();
    }
    setActivo(p);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Mis pedidos</h1>
        <p className="text-sm text-muted-foreground">
          {activos.length} activo{activos.length === 1 ? '' : 's'} · {historial.length} histórico
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <TabBtn active={filter === 'activos'} onClick={() => setFilter('activos')}>
          Activos ({activos.length})
        </TabBtn>
        <TabBtn active={filter === 'historial'} onClick={() => setFilter('historial')}>
          Historial ({historial.length})
        </TabBtn>
      </div>

      <ul className="space-y-3">
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
                  Entrega: {p.fecha_entrega} · {p.items.length} producto
                  {p.items.length === 1 ? '' : 's'} ·{' '}
                  {formatCurrency(
                    p.items.reduce(
                      (s, i) =>
                        s + (i.cantidad_final ?? i.cantidad_estimada) * i.precio_unitario,
                      0,
                    ),
                  )}
                </div>
                {p.notas && (
                  <div className="mt-1 text-xs italic text-muted-foreground">{p.notas}</div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {['pendiente', 'en_ruta'].includes(p.estado) && (
                  <Button size="sm" onClick={() => abrirPedido(p)}>
                    {p.estado === 'pendiente' ? 'Ver y ejecutar' : 'Continuar'}
                  </Button>
                )}
                {p.estado === 'completado' || p.estado === 'parcial' ? (
                  <span className="text-xs text-muted-foreground">
                    Venta #{p.venta_id?.slice(0, 8)}
                  </span>
                ) : null}
              </div>
            </div>
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {p.items.slice(0, 6).map((it) => (
                <li key={it.id}>
                  • {it.producto_nombre} —{' '}
                  {(it.cantidad_final ?? it.cantidad_estimada).toFixed(2)}{' '}
                  {it.tipo_unidad === 'weight' ? 'lb' : it.unidad}
                </li>
              ))}
              {p.items.length > 6 && <li>… y {p.items.length - 6} más</li>}
            </ul>
          </li>
        ))}
        {lista.length === 0 && (
          <li className="rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground">
            {filter === 'activos'
              ? 'No tienes pedidos pendientes en este momento.'
              : 'Sin pedidos en el historial.'}
          </li>
        )}
      </ul>

      {activo && (
        <EjecutarPedidoDialog
          pedido={activo}
          productos={productos}
          vendedorId={vendedorId}
          onClose={() => setActivo(null)}
          onConfirmed={() => {
            setActivo(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TabBtn({
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
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
