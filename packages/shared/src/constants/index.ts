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

export const CAJA_ESTADO = {
  ABIERTA: 'abierta',
  CERRADA: 'cerrada',
} as const;

export type CajaEstado = (typeof CAJA_ESTADO)[keyof typeof CAJA_ESTADO];

export const CREDITO_ESTADO = {
  VIGENTE: 'vigente',
  PAGADO: 'pagado',
  VENCIDO: 'vencido',
} as const;

export type CreditoEstado = (typeof CREDITO_ESTADO)[keyof typeof CREDITO_ESTADO];

export const CREDITO_PLAZO_DIAS_DEFAULT = 30;

export const DESPACHO_ESTADO = {
  PENDIENTE: 'pendiente',
  EN_RUTA: 'en_ruta',
  ENTREGADO: 'entregado',
  FALLIDO: 'fallido',
} as const;

export type DespachoEstado = (typeof DESPACHO_ESTADO)[keyof typeof DESPACHO_ESTADO];

export const DESPACHO_ITEM_ESTADO = {
  PENDIENTE: 'pendiente',
  ENTREGADO: 'entregado',
  FALLIDO: 'fallido',
} as const;

export type DespachoItemEstado = (typeof DESPACHO_ITEM_ESTADO)[keyof typeof DESPACHO_ITEM_ESTADO];

export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
