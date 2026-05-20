'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type VentaSinDespacho = {
  id: string;
  total: number;
  fecha: string;
  clientes: { nombre: string } | null;
  profiles: { full_name: string | null } | null;
};

type DespachoItem = {
  id: string;
  estado: 'pendiente' | 'entregado' | 'fallido';
  notas: string | null;
  entregado_at: string | null;
  ventas: { id: string; total: number; clientes: { nombre: string } | null; fecha: string } | null;
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

const ESTADO_DESPACHO: Record<string, string> = {
  pendiente:  'bg-yellow-100 text-yellow-700',
  en_ruta:    'bg-blue-100 text-blue-700',
  entregado:  'bg-green-100 text-green-700',
  fallido:    'bg-red-100 text-red-700',
};

export function DespachoClient({
  initialDespachos,
  ventasSinDespacho,
  fecha,
}: {
  initialDespachos: Despacho[];
  ventasSinDespacho: VentaSinDespacho[];
  fecha: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [despachos, setDespachos] = useState(initialDespachos);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [openNuevo, setOpenNuevo] = useState(false);
  const [creando, setCreando] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Agrupar ventas sin despacho por vendedor para asignarlas correctamente.
  const vendedoresDisponibles = Array.from(
    new Map(
      ventasSinDespacho.map((v) => [v.profiles?.full_name ?? 'Sin nombre', v.profiles?.full_name]),
    ).entries(),
  );

  async function crearDespacho() {
    if (seleccionadas.size === 0) return;
    setCreando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;

    // Determinar vendedor_id de las ventas seleccionadas.
    const primeraVenta = ventasSinDespacho.find((v) => seleccionadas.has(v.id));
    if (!primeraVenta || !companyId) { setCreando(false); return; }

    const ventaIds = [...seleccionadas];
    // Obtener vendedor_id desde la primera venta.
    const { data: venta } = await supabase
      .from('ventas')
      .select('vendedor_id')
      .eq('id', ventaIds[0]!)
      .single();
    if (!venta) { setCreando(false); return; }

    const { data: despacho, error: errD } = await supabase
      .from('despachos')
      .insert({ company_id: companyId, vendedor_id: venta.vendedor_id, fecha })
      .select('id')
      .single();
    if (errD || !despacho) { alert(errD?.message); setCreando(false); return; }

    const items = ventaIds.map((vid) => ({
      despacho_id: despacho.id,
      company_id: companyId,
      venta_id: vid,
    }));
    const { error: errI } = await supabase.from('despacho_items').insert(items);
    if (errI) { alert(errI.message); setCreando(false); return; }

    setSeleccionadas(new Set());
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
    if (error) { alert(error.message); return; }
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
          <Button variant="outline" onClick={() => router.refresh()}>Actualizar</Button>
          {ventasSinDespacho.length > 0 && (
            <Dialog open={openNuevo} onOpenChange={setOpenNuevo}>
              <DialogTrigger asChild>
                <Button>Nuevo despacho</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Crear despacho</DialogTitle>
                  <DialogDescription>Selecciona las ventas a incluir.</DialogDescription>
                </DialogHeader>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {ventasSinDespacho.map((v) => (
                    <label
                      key={v.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(v.id)}
                        onChange={(e) => {
                          const next = new Set(seleccionadas);
                          e.target.checked ? next.add(v.id) : next.delete(v.id);
                          setSeleccionadas(next);
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {v.clientes?.nombre ?? 'Sin cliente'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.profiles?.full_name ?? '—'} · {formatCurrency(Number(v.total))}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={seleccionadas.size === 0 || creando}
                  onClick={crearDespacho}
                >
                  {creando ? 'Creando…' : `Crear despacho (${seleccionadas.size} ventas)`}
                </Button>
              </DialogContent>
            </Dialog>
          )}
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
                  <span className="font-semibold">{d.profiles?.full_name ?? d.vendedor_id.slice(0, 8)}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {entregados}/{d.despacho_items.length} entregados · {formatCurrency(total)}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_DESPACHO[d.estado] ?? ''}`}>
                  {d.estado.replace('_', ' ')}
                </span>
              </div>
              <div className="divide-y">
                {d.despacho_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="font-medium">
                        {item.ventas?.clientes?.nombre ?? 'Sin cliente'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(Number(item.ventas?.total ?? 0))}
                        {item.entregado_at && (
                          <span className="ml-2">
                            · {new Date(item.entregado_at).toLocaleTimeString('es-PE', { timeStyle: 'short' })}
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
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_DESPACHO[item.estado] ?? ''}`}
                        >
                          {item.estado}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
