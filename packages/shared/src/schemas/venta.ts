import { z } from 'zod';
import { METODO_PAGO } from '../constants/index.js';

export const ventaItemSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().positive(),
  precio_unitario: z.coerce.number().nonnegative(),
});
export type VentaItemInput = z.infer<typeof ventaItemSchema>;

export const ventaCreateSchema = z.object({
  cliente_id: z.string().uuid().optional().nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  metodo_pago: z.enum([METODO_PAGO.EFECTIVO, METODO_PAGO.TRANSFERENCIA, METODO_PAGO.CREDITO]),
  descuento: z.coerce.number().nonnegative().default(0),
  notas: z.string().max(500).optional().nullable(),
  items: z.array(ventaItemSchema).min(1, 'Agrega al menos un producto'),
});
export type VentaCreateInput = z.infer<typeof ventaCreateSchema>;
