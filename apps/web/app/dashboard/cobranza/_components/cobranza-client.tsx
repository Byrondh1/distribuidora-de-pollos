'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RegistrarPagoDialog } from './registrar-pago-dialog';

type CreditoRow = {
  id: string;
  monto_original: number;
  saldo_pendiente: number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: 'vigente' | 'pagado' | 'vencido';
  notas: string | null;
  clientes: { id: string; nombre: string; telefono: string | null } | null;
  ventas: { id: string; fecha: string; metodo_pago: string } | null;
};

const ESTADO_STYLES: Record<string, string> = {
  vigente: 'bg-yellow-100 text-yellow-700',
  vencido: 'bg-red-100 text-red-700',
  pagado:  'bg-green-100 text-green-700',
};

export function CobranzaClient({ initialRows }: { initialRows: CreditoRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');

  const totalPendiente = rows.reduce((s, r) => s + Number(r.saldo_pendiente), 0);
  const vencidos = rows.filter((r) => r.estado === 'vencido').length;

  const filtered = rows.filter(
    (r) =>
      !query ||
      (r.clientes?.nombre ?? '').toLowerCase().includes(query.toLowerCase()) ||
      (r.clientes?.telefono ?? '').includes(query),
  );

  function handlePagoAplicado(creditoId: string, nuevoSaldo: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === creditoId
          ? { ...r, saldo_pendiente: nuevoSaldo, estado: nuevoSaldo === 0 ? 'pagado' : r.estado }
          : r,
      ),
    );
    router.refresh();
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Cobranza</h1>
          <p className="text-sm text-muted-foreground">
            Pendiente: {formatCurrency(totalPendiente)} · {vencidos} vencidos
          </p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()}>
          Actualizar
        </Button>
      </div>
      <Input
        placeholder="Buscar por cliente o teléfono…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {/* Lista móvil */}
      <ul className="space-y-2 md:hidden">
        {filtered.map((r) => {
          const diasRestantes = r.fecha_vencimiento
            ? Math.ceil(
                (new Date(r.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              )
            : null;
          return (
            <li key={r.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{r.clientes?.nombre ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.clientes?.telefono ?? '—'} · emisión {r.fecha_emision}
                  </div>
                  {r.fecha_vencimiento && (
                    <div className="text-xs">
                      <span
                        className={
                          diasRestantes !== null && diasRestantes <= 0
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }
                      >
                        Vence {r.fecha_vencimiento}
                        {diasRestantes !== null &&
                          ` (${diasRestantes > 0 ? `${diasRestantes}d` : 'vencido'})`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatCurrency(Number(r.saldo_pendiente))}
                  </div>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[r.estado] ?? ''}`}
                  >
                    {r.estado}
                  </span>
                </div>
              </div>
              {r.estado !== 'pagado' && (
                <div className="mt-3 flex justify-end">
                  <RegistrarPagoDialog
                    creditoId={r.id}
                    clienteNombre={r.clientes?.nombre ?? '—'}
                    saldoPendiente={Number(r.saldo_pendiente)}
                    onPagoRegistrado={(nuevoSaldo) => handlePagoAplicado(r.id, nuevoSaldo)}
                  />
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
            Sin créditos pendientes
          </li>
        )}
      </ul>

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Teléfono</th>
              <th className="px-4 py-2 font-medium">Emisión</th>
              <th className="px-4 py-2 font-medium">Vencimiento</th>
              <th className="px-4 py-2 text-right font-medium">Original</th>
              <th className="px-4 py-2 text-right font-medium">Pendiente</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const diasRestantes = r.fecha_vencimiento
                ? Math.ceil(
                    (new Date(r.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  )
                : null;
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {r.clientes?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.clientes?.telefono ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.fecha_emision}</td>
                  <td className="px-4 py-2">
                    {r.fecha_vencimiento ? (
                      <span className={diasRestantes !== null && diasRestantes <= 0 ? 'text-destructive font-medium' : ''}>
                        {r.fecha_vencimiento}
                        {diasRestantes !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({diasRestantes > 0 ? `${diasRestantes}d` : 'vencido'})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(Number(r.monto_original))}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {formatCurrency(Number(r.saldo_pendiente))}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[r.estado] ?? ''}`}
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.estado !== 'pagado' && (
                      <RegistrarPagoDialog
                        creditoId={r.id}
                        clienteNombre={r.clientes?.nombre ?? '—'}
                        saldoPendiente={Number(r.saldo_pendiente)}
                        onPagoRegistrado={(nuevoSaldo) => handlePagoAplicado(r.id, nuevoSaldo)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Sin créditos pendientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
