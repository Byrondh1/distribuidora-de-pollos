'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type CajaRow = {
  caja_id: string;
  vendedor_id: string;
  fecha: string;
  monto_apertura: number;
  monto_cierre: number | null;
  estado: 'abierta' | 'cerrada';
  notas_cierre: string | null;
  total_efectivo: number;
  total_transferencia: number;
  total_credito: number;
  total_ventas: number;
  num_ventas: number;
};

export function CajaClient({ rows, fecha }: { rows: CajaRow[]; fecha: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalEfectivo      = rows.reduce((s, r) => s + Number(r.total_efectivo), 0);
  const totalTransferencia = rows.reduce((s, r) => s + Number(r.total_transferencia), 0);
  const totalCredito       = rows.reduce((s, r) => s + Number(r.total_credito), 0);
  const totalVentas        = rows.reduce((s, r) => s + Number(r.total_ventas), 0);
  const totalVentasCount   = rows.reduce((s, r) => s + Number(r.num_ventas), 0);
  const cajasAbiertas      = rows.filter((r) => r.estado === 'abierta').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caja del día</h1>
          <p className="text-sm text-muted-foreground">{fecha} · {cajasAbiertas} cajas abiertas</p>
        </div>
        <Button variant="outline" onClick={() => router.refresh()}>Actualizar</Button>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Efectivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalEfectivo)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transferencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTransferencia)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCredito)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total · {totalVentasCount} ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalVentas)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Por vendedor */}
      <div className="space-y-3">
        <h2 className="font-semibold">Por vendedor</h2>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Ningún vendedor ha abierto caja hoy.</p>
        )}
        {rows.map((r) => (
          <div key={r.caja_id} className="overflow-hidden rounded-lg border">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
              onClick={() => setExpanded(expanded === r.caja_id ? null : r.caja_id)}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${r.estado === 'abierta' ? 'bg-green-500' : 'bg-muted-foreground'}`}
                />
                <div>
                  <div className="font-medium">{r.vendedor_id.slice(0, 8)}…</div>
                  <div className="text-xs text-muted-foreground">
                    {r.num_ventas} ventas · {r.estado}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(Number(r.total_ventas))}</div>
                {r.monto_cierre !== null && (
                  <div className="text-xs text-muted-foreground">
                    Cierre: {formatCurrency(Number(r.monto_cierre))}
                  </div>
                )}
              </div>
            </button>
            {expanded === r.caja_id && (
              <div className="border-t bg-muted/30 px-4 py-3 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-muted-foreground">Apertura</div>
                    <div className="font-medium">{formatCurrency(Number(r.monto_apertura))}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Efectivo cobrado</div>
                    <div className="font-medium">{formatCurrency(Number(r.total_efectivo))}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Esperado en caja</div>
                    <div className="font-bold">
                      {formatCurrency(Number(r.monto_apertura) + Number(r.total_efectivo))}
                    </div>
                  </div>
                </div>
                {r.estado === 'cerrada' && (
                  <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3">
                    <div>
                      <div className="text-muted-foreground">Cierre declarado</div>
                      <div className="font-medium">{formatCurrency(Number(r.monto_cierre))}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Diferencia</div>
                      <div
                        className={`font-semibold ${
                          Number(r.monto_cierre) - (Number(r.monto_apertura) + Number(r.total_efectivo)) < 0
                            ? 'text-destructive'
                            : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(
                          Number(r.monto_cierre) -
                            (Number(r.monto_apertura) + Number(r.total_efectivo)),
                        )}
                      </div>
                    </div>
                    {r.notas_cierre && (
                      <div className="col-span-2">
                        <div className="text-muted-foreground">Notas</div>
                        <div>{r.notas_cierre}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
