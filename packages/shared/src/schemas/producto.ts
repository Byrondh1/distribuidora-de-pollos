import { z } from 'zod';
import { MOVIMIENTO_TIPOS } from '../constants/index';

export const productoCreateSchema = z.object({
  sku: z.string().min(1).max(40),
  nombre: z.string().min(2).max(120),
  categoria: z.string().max(60).optional().nullable(),
  unidad: z.string().min(1).max(20).default('unidad'),
  precio_base: z.coerce.number().nonnegative(),
  activo: z.boolean().default(true),
});
export type ProductoCreateInput = z.infer<typeof productoCreateSchema>;

export const movimientoCreateSchema = z.object({
  producto_id: z.string().uuid(),
  tipo: z.enum([
    MOVIMIENTO_TIPOS.ENTRADA,
    MOVIMIENTO_TIPOS.SALIDA,
    MOVIMIENTO_TIPOS.AJUSTE,
  ]),
  cantidad: z.coerce.number().positive(),
  motivo: z.string().max(200).optional().nullable(),
});
export type MovimientoCreateInput = z.infer<typeof movimientoCreateSchema>;
