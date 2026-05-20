export const ROLES = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const MOVIMIENTO_TIPOS = {
  ENTRADA: 'entrada',
  SALIDA: 'salida',
  AJUSTE: 'ajuste',
} as const;

export type MovimientoTipo = (typeof MOVIMIENTO_TIPOS)[keyof typeof MOVIMIENTO_TIPOS];

export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
