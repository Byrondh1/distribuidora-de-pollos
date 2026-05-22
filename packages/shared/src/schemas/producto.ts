import { z } from 'zod';
import { MOVIMIENTO_TIPOS } from '../constants/index';

export const PRODUCTO_TIPO_UNIDAD = ['unit', 'weight'] as const;
export type ProductoTipoUnidad = (typeof PRODUCTO_TIPO_UNIDAD)[number];

export const productoCreateSchema = z
  .object({
    sku: z.string().min(1).max(40),
    nombre: z.string().min(2).max(120),
    categoria: z.string().max(60).optional().nullable(),
    unidad: z.string().min(1).max(20).default('unidad'),
    tipo_unidad: z.enum(PRODUCTO_TIPO_UNIDAD).default('unit'),
    precio_base: z.coerce.number().nonnegative(),
    precio_libra: z.coerce.number().nonnegative().optional().nullable(),
    activo: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.tipo_unidad === 'weight') {
      if (v.precio_libra == null || v.precio_libra <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['precio_libra'],
          message: 'Precio por libra requerido para productos por peso',
        });
      }
    }
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
