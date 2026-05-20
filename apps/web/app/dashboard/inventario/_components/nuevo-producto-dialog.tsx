'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productoCreateSchema, type ProductoCreateInput } from '@distribuapp/shared/schemas';
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

export function NuevoProductoDialog({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductoCreateInput>({
    resolver: zodResolver(productoCreateSchema),
    defaultValues: { unidad: 'unidad', precio_base: 0, activo: true },
  });

  async function onSubmit(values: ProductoCreateInput) {
    setServerError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;
    if (!companyId) {
      setServerError('Tu cuenta no tiene empresa asignada.');
      return;
    }
    const { error } = await supabase.from('productos').insert({ ...values, company_id: companyId });
    if (error) {
      setServerError(error.message);
      return;
    }
    reset();
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nuevo producto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>Se creará con stock 0. Ajústalo desde la tabla.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register('sku')} />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidad">Unidad</Label>
              <Input id="unidad" {...register('unidad')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input id="categoria" {...register('categoria')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_base">Precio base</Label>
              <Input id="precio_base" type="number" step="0.01" {...register('precio_base')} />
              {errors.precio_base && (
                <p className="text-xs text-destructive">{errors.precio_base.message}</p>
              )}
            </div>
          </div>
          {serverError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Crear producto'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
