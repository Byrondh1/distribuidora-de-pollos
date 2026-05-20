// Estado local de una venta en curso (borrador en el dispositivo antes de sincronizar).
import { create } from 'zustand';
import type { VentaItemInput } from '@distribuapp/shared/schemas';

type ItemConNombre = VentaItemInput & { nombre: string; sku: string };

type VentaStore = {
  clienteId: string | null;
  clienteNombre: string | null;
  metodoPago: 'efectivo' | 'transferencia' | 'credito';
  descuento: number;
  items: ItemConNombre[];
  setCliente: (id: string | null, nombre: string | null) => void;
  setMetodoPago: (m: 'efectivo' | 'transferencia' | 'credito') => void;
  setDescuento: (d: number) => void;
  addItem: (item: ItemConNombre) => void;
  updateItem: (productoId: string, cantidad: number) => void;
  removeItem: (productoId: string) => void;
  reset: () => void;
  subtotal: () => number;
  total: () => number;
};

const INITIAL: Pick<VentaStore, 'clienteId' | 'clienteNombre' | 'metodoPago' | 'descuento' | 'items'> = {
  clienteId: null,
  clienteNombre: null,
  metodoPago: 'efectivo',
  descuento: 0,
  items: [],
};

export const useVentaStore = create<VentaStore>((set, get) => ({
  ...INITIAL,
  setCliente: (id, nombre) => set({ clienteId: id, clienteNombre: nombre }),
  setMetodoPago: (m) => set({ metodoPago: m }),
  setDescuento: (d) => set({ descuento: d }),
  addItem: (item) =>
    set((s) => {
      const idx = s.items.findIndex((i) => i.producto_id === item.producto_id);
      if (idx >= 0) {
        const updated = [...s.items];
        const existing = updated[idx]!;
        updated[idx] = { ...existing, cantidad: existing.cantidad + item.cantidad };
        return { items: updated };
      }
      return { items: [...s.items, item] };
    }),
  updateItem: (productoId, cantidad) =>
    set((s) => ({
      items:
        cantidad <= 0
          ? s.items.filter((i) => i.producto_id !== productoId)
          : s.items.map((i) => (i.producto_id === productoId ? { ...i, cantidad } : i)),
    })),
  removeItem: (productoId) =>
    set((s) => ({ items: s.items.filter((i) => i.producto_id !== productoId) })),
  reset: () => set(INITIAL),
  subtotal: () => get().items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0),
  total: () => get().subtotal() - get().descuento,
}));
