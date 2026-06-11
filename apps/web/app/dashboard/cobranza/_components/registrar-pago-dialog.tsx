'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pagoCreditorSchema, type PagoCreditoInput } from '@distribuapp/shared/schemas';
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
import { formatCurrency } from '@/lib/utils';

type Props = {
  creditoId: string;
  clienteNombre: string;
  saldoPendiente: number;
  onPagoRegistrado: (nuevoSaldo: number) => void;
};

export function RegistrarPagoDialog({
  creditoId,
  clienteNombre,
  saldoPendiente,
  onPagoRegistrado,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PagoCreditoInput>({
    resolver: zodResolver(pagoCreditorSchema),
    defaultValues: {
      credito_id: creditoId,
      metodo_pago: 'efectivo',
      fecha: new Date().toISOString().slice(0, 10),
    },
  });

  async function onSubmit(values: PagoCreditoInput) {
    setServerError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;
    if (!companyId || !user) { setServerError('Sesión inválida.'); return; }

    const { error } = await supabase.from('pagos_credito').insert({
      ...values,
      company_id: companyId,
      usuario_id: user.id,
    });
    if (error) { setServerError(error.message); return; }

    const nuevoSaldo = Math.max(0, saldoPendiente - values.monto);
    reset({ credito_id: creditoId, metodo_pago: 'efectivo', fecha: new Date().toISOString().slice(0, 10) });
    setOpen(false);
    onPagoRegistrado(nuevoSaldo);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Registrar pago</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {clienteNombre} · Saldo: {formatCurrency(saldoPendiente)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('credito_id')} />
          <div className="space-y-2">
            <Label htmlFor="monto">Monto a abonar</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              max={saldoPendiente}
              min={0.01}
              {...register('monto')}
              placeholder={saldoPendiente.toFixed(2)}
            />
            {errors.monto && <p className="text-xs text-destructive">{errors.monto.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...register('fecha')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metodo_pago">Método de pago</Label>
            <select
              id="metodo_pago"
              {...register('metodo_pago')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Input id="notas" {...register('notas')} placeholder="Referencia, observación…" />
          </div>
          {serverError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Registrar pago'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
