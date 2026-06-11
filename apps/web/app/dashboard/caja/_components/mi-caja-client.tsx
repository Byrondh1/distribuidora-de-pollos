'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

type CajaResumen = {
  caja_id: string;
  fecha: string;
  monto_apertura: number;
  monto_cierre: number | null;
  estado: 'abierta' | 'cerrada';
  total_efectivo: number;
  total_transferencia: number;
  total_credito: number;
  total_ventas: number;
  num_ventas: number;
};

export function MiCajaClient({
  initial,
  fecha,
}: {
  initial: CajaResumen | null;
  fecha: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [resumen, setResumen] = useState<CajaResumen | null>(initial);
  const [montoApertura, setMontoApertura] = useState('0');
  const [montoCierre, setMontoCierre] = useState('');
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(false);

  async function recargar() {
    const { data } = await supabase
      .from('caja_resumen')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle();
    setResumen((data as CajaResumen | null) ?? null);
    router.refresh();
  }

  async function abrir() {
    setBusy(true);
    const { error } = await supabase.rpc('abrir_caja', {
      p_monto_apertura: parseFloat(montoApertura) || 0,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await recargar();
  }

  async function cerrar() {
    const cierre = parseFloat(montoCierre);
    if (isNaN(cierre) || cierre < 0) {
      alert('Ingresa un monto de cierre válido');
      return;
    }
    if (!confirm(`Cerrar caja con ${formatCurrency(cierre)}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('cerrar_caja', {
      p_monto_cierre: cierre,
      p_notas: notas || undefined,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    await recargar();
  }

  const esperado = resumen
    ? Number(resumen.monto_apertura) + Number(resumen.total_efectivo)
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Mi caja</h1>
        <p className="text-sm text-muted-foreground">{fecha}</p>
      </div>

      {!resumen ? (
        <Card>
          <CardHeader>
            <CardTitle>Abrir caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="apertura">Monto inicial en efectivo</Label>
              <Input
                id="apertura"
                type="number"
                min="0"
                step="0.01"
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={abrir} disabled={busy} className="w-full">
              {busy ? 'Abriendo…' : 'Abrir caja'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Resumen del día</CardTitle>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  resumen.estado === 'abierta'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {resumen.estado}
              </span>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linea label="Ventas del día" valor={String(resumen.num_ventas)} />
              <Linea label="Efectivo" valor={formatCurrency(Number(resumen.total_efectivo))} />
              <Linea
                label="Transferencia"
                valor={formatCurrency(Number(resumen.total_transferencia))}
              />
              <Linea label="Crédito" valor={formatCurrency(Number(resumen.total_credito))} />
              <div className="my-2 border-t" />
              <Linea
                label="Total ventas"
                valor={formatCurrency(Number(resumen.total_ventas))}
                bold
              />
              <Linea
                label="Apertura"
                valor={formatCurrency(Number(resumen.monto_apertura))}
              />
              <Linea label="Esperado en caja" valor={formatCurrency(esperado)} bold />
            </CardContent>
          </Card>

          {resumen.estado === 'abierta' ? (
            <Card>
              <CardHeader>
                <CardTitle>Cerrar caja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="cierre">Monto contado</Label>
                  <Input
                    id="cierre"
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoCierre}
                    onChange={(e) => setMontoCierre(e.target.value)}
                    placeholder={esperado.toFixed(2)}
                    className="mt-1"
                  />
                  {montoCierre && (
                    <p
                      className={`mt-1 text-xs ${
                        parseFloat(montoCierre) - esperado >= -0.005
                          ? 'text-green-600'
                          : 'text-destructive'
                      }`}
                    >
                      Diferencia: {formatCurrency(parseFloat(montoCierre) - esperado)}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="notas">Notas (opcional)</Label>
                  <Input
                    id="notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Observaciones del cierre…"
                    className="mt-1"
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={cerrar}
                  disabled={busy}
                  className="w-full"
                >
                  {busy ? 'Cerrando…' : 'Cerrar caja'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-1 pt-6 text-sm">
                <Linea
                  label="Cierre declarado"
                  valor={formatCurrency(Number(resumen.monto_cierre))}
                  bold
                />
                <Linea
                  label="Diferencia"
                  valor={formatCurrency(Number(resumen.monto_cierre) - esperado)}
                  color={
                    Number(resumen.monto_cierre) - esperado >= -0.005
                      ? 'text-green-600'
                      : 'text-destructive'
                  }
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Linea({
  label,
  valor,
  bold,
  color,
}: {
  label: string;
  valor: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} ${color ?? ''}`}>{valor}</span>
    </div>
  );
}
