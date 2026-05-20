import { z } from 'zod';

export const clienteCreateSchema = z.object({
  nombre: z.string().min(2).max(120),
  telefono: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  direccion: z.string().max(200).optional().nullable(),
  ruc: z.string().max(20).optional().nullable(),
  limite_credito: z.coerce.number().nonnegative().default(0),
  activo: z.boolean().default(true),
});
export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>;

export const precioClienteSchema = z.object({
  producto_id: z.string().uuid(),
  precio: z.coerce.number().nonnegative(),
});
export type PrecioClienteInput = z.infer<typeof precioClienteSchema>;
