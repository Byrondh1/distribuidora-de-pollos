import { z } from 'zod';
import { METODO_PAGO } from '../constants/index';

export const pagoCreditorSchema = z.object({
  credito_id: z.string().uuid(),
  monto: z.coerce.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  metodo_pago: z.enum([METODO_PAGO.EFECTIVO, METODO_PAGO.TRANSFERENCIA, METODO_PAGO.CREDITO]).default(METODO_PAGO.EFECTIVO),
  notas: z.string().max(300).optional().nullable(),
});
export type PagoCreditoInput = z.infer<typeof pagoCreditorSchema>;
