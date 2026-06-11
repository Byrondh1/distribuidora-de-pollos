'use client';

import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';

export function NuevoProductoDialog({ onCreated }: { onCreated: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductoCreateInput>({
    resolver: zodResolver(productoCreateSchema),
    defaultValues: {
      unidad: 'unidad',
      tipo_unidad: 'unit',
      precio_base: 0,
      precio_libra: null,
      activo: true,
    },
  });

  const tipo = watch('tipo_unidad');

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

    const payload = {
      ...values,
      company_id: companyId,
      precio_libra: values.tipo_unidad === 'weight' ? values.precio_libra : null,
      unidad: values.tipo_unidad === 'weight' ? 'lb' : values.unidad || 'unidad',
    };

    const { error } = await supabase.from('productos').insert(payload as any);
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
          <div className="space-y-2">
            <Label>Tipo de venta</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setValue('tipo_unidad', 'unit', { shouldValidate: true })}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium',
                  tipo === 'unit'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                Por unidad
              </button>
              <button
                type="button"
                onClick={() => setValue('tipo_unidad', 'weight', { shouldValidate: true })}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium',
                  tipo === 'weight'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                Por libra
              </button>
            </div>
            <input type="hidden" {...register('tipo_unidad')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register('sku')} />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidad">Unidad</Label>
              <Input
                id="unidad"
                {...register('unidad')}
                placeholder={tipo === 'weight' ? 'lb' : 'unidad'}
                disabled={tipo === 'weight'}
              />
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
            {tipo === 'unit' ? (
              <div className="space-y-2">
                <Label htmlFor="precio_base">Precio por unidad</Label>
                <Input id="precio_base" type="number" step="0.01" {...register('precio_base')} />
                {errors.precio_base && (
                  <p className="text-xs text-destructive">{errors.precio_base.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="precio_libra">Precio por libra</Label>
                <Input id="precio_libra" type="number" step="0.01" {...register('precio_libra')} />
                {errors.precio_libra && (
                  <p className="text-xs text-destructive">{errors.precio_libra.message}</p>
                )}
              </div>
            )}
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
