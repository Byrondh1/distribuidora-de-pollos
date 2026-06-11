'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clienteCreateSchema, type ClienteCreateInput } from '@distribuapp/shared/schemas';
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

export function NuevoClienteDialog({ onCreated }: { onCreated: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClienteCreateInput>({ resolver: zodResolver(clienteCreateSchema) });

  async function onSubmit(values: ClienteCreateInput) {
    setServerError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;
    if (!companyId) { setServerError('Sin empresa asignada.'); return; }
    const { error } = await supabase.from('clientes').insert({ ...values, company_id: companyId });
    if (error) { setServerError(error.message); return; }
    reset();
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo cliente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>Datos básicos del cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" {...register('telefono')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC</Label>
              <Input id="ruc" {...register('ruc')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" {...register('direccion')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="limite_credito">Límite de crédito (S/)</Label>
            <Input id="limite_credito" type="number" step="0.01" min="0" {...register('limite_credito')} defaultValue={0} />
          </div>
          {serverError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Crear cliente'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
