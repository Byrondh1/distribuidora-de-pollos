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

export const METODO_PAGO = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  CREDITO: 'credito',
} as const;

export type MetodoPago = (typeof METODO_PAGO)[keyof typeof METODO_PAGO];

export const VENTA_ESTADO = {
  BORRADOR: 'borrador',
  CONFIRMADA: 'confirmada',
  ANULADA: 'anulada',
} as const;

export type VentaEstado = (typeof VENTA_ESTADO)[keyof typeof VENTA_ESTADO];

export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
