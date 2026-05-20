import { z } from 'zod';

export const abrirCajaSchema = z.object({
  monto_apertura: z.coerce.number().nonnegative().default(0),
});
export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;

export const cerrarCajaSchema = z.object({
  monto_cierre: z.coerce.number().nonnegative(),
  notas: z.string().max(500).optional().nullable(),
});
export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;
