import { z } from 'zod';
import { PIN_LENGTH } from '../constants/index';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const pinSchema = z
  .string()
  .length(PIN_LENGTH, `El PIN debe tener ${PIN_LENGTH} dígitos`)
  .regex(/^\d+$/, 'Solo dígitos');

export const pinSetupSchema = z
  .object({
    pin: pinSchema,
    confirm: pinSchema,
  })
  .refine((d) => d.pin === d.confirm, {
    message: 'Los PIN no coinciden',
    path: ['confirm'],
  });
export type PinSetupInput = z.infer<typeof pinSetupSchema>;
