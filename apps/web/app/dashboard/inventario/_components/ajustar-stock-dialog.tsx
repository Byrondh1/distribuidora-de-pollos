'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { movimientoCreateSchema, type MovimientoCreateInput } from '@distribuapp/shared/schemas';
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

type Props = {
  productoId: string;
  productoNombre: string;
  onApplied: () => void;
};

export function AjustarStockDialog({ productoId, productoNombre, onApplied }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MovimientoCreateInput>({
    resolver: zodResolver(movimientoCreateSchema),
    defaultValues: { producto_id: productoId, tipo: 'entrada' },
  });

  async function onSubmit(values: MovimientoCreateInput) {
    setServerError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;
    if (!companyId || !user) {
      setServerError('Sesión inválida.');
      return;
    }
    const { error } = await supabase.from('movimientos_inventario').insert({
      ...values,
      company_id: companyId,
      usuario_id: user.id,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    reset({ producto_id: productoId, tipo: 'entrada' });
    setOpen(false);
    onApplied();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Ajustar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>{productoNombre}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('producto_id')} />
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de movimiento</Label>
            <select
              id="tipo"
              {...register('tipo')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="entrada">Entrada (suma stock)</option>
              <option value="salida">Salida (resta stock)</option>
              <option value="ajuste">Ajuste (cantidad firmada en motivo)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cantidad">Cantidad</Label>
            <Input id="cantidad" type="number" step="0.001" {...register('cantidad')} />
            {errors.cantidad && (
              <p className="text-xs text-destructive">{errors.cantidad.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Input id="motivo" {...register('motivo')} placeholder="Compra, merma, conteo…" />
          </div>
          {serverError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
