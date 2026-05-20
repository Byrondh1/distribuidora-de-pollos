'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';

type VentaRow = {
  id: string;
  fecha: string;
  total: number;
  subtotal: number;
  descuento: number;
  metodo_pago: string;
  estado: string;
  notas: string | null;
  created_at: string;
  clientes: { nombre: string } | null;
  profiles: { full_name: string | null } | null;
};

const ESTADO_STYLES: Record<string, string> = {
  borrador:   'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-green-100 text-green-700',
  anulada:    'bg-red-100 text-red-700',
};

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  credito: 'Crédito',
};

export function VentasClient({ initialRows }: { initialRows: VentaRow[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = rows.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (r.clientes?.nombre ?? '').toLowerCase().includes(q) ||
      r.estado.includes(q) ||
      r.metodo_pago.includes(q)
    );
  });

  async function handleConfirmar(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc('confirmar_venta', { p_venta_id: id });
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado: 'confirmada' } : r)),
    );
  }

  async function handleAnular(id: string) {
    if (!confirm('¿Anular esta venta? Si estaba confirmada, se revertirá el stock.')) return;
    setBusy(id);
    const { error } = await supabase.rpc('anular_venta', { p_venta_id: id });
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado: 'anulada' } : r)),
    );
  }

  const totalHoy = rows
    .filter((r) => r.estado === 'confirmada' && r.fecha === new Date().toISOString().slice(0, 10))
    .reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            {rows.filter((r) => r.estado === 'confirmada').length} confirmadas ·{' '}
            confirmado hoy: {formatCurrency(totalHoy)}
          </p>
        </div>
        <Button onClick={() => router.refresh()} variant="outline">Actualizar</Button>
      </div>
      <Input
        placeholder="Buscar por cliente, estado, método…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Vendedor</th>
              <th className="px-4 py-2 font-medium">Método</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 text-muted-foreground">{r.fecha}</td>
                <td className="px-4 py-2">{r.clientes?.nombre ?? <span className="text-muted-foreground">Sin cliente</span>}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.profiles?.full_name ?? '—'}</td>
                <td className="px-4 py-2">{METODO_LABELS[r.metodo_pago] ?? r.metodo_pago}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(r.total))}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[r.estado] ?? ''}`}>
                    {r.estado}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    {r.estado === 'borrador' && (
                      <Button
                        size="sm"
                        onClick={() => handleConfirmar(r.id)}
                        disabled={busy === r.id}
                      >
                        {busy === r.id ? '…' : 'Confirmar'}
                      </Button>
                    )}
                    {r.estado !== 'anulada' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAnular(r.id)}
                        disabled={busy === r.id}
                      >
                        Anular
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Sin ventas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
