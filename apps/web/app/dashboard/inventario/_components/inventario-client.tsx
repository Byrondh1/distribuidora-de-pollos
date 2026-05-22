'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { NuevoProductoDialog } from './nuevo-producto-dialog';
import { AjustarStockDialog } from './ajustar-stock-dialog';
import { formatCurrency } from '@/lib/utils';

export type InventarioRow = {
  id: string;
  sku: string;
  nombre: string;
  categoria: string | null;
  unidad: string;
  tipo_unidad: 'unit' | 'weight';
  precio_base: number;
  precio_libra: number | null;
  activo: boolean;
  stock: number;
  stock_minimo: number;
  ubicacion: string | null;
};

export function InventarioClient({
  initialRows,
  role,
}: {
  initialRows: InventarioRow[];
  role: 'admin' | 'vendedor';
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const canEdit = role === 'admin';

  useEffect(() => {
    const channel = supabase
      .channel('inventario-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario' },
        (payload) => {
          const next = (payload.new ?? payload.old) as {
            producto_id: string;
            stock?: number;
            stock_minimo?: number;
          };
          if (!next?.producto_id) return;
          setRows((prev) =>
            prev.map((r) =>
              r.id === next.producto_id
                ? {
                    ...r,
                    stock: Number(next.stock ?? r.stock),
                    stock_minimo: Number(next.stock_minimo ?? r.stock_minimo),
                  }
                : r,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filtered = rows.filter(
    (r) =>
      !query ||
      r.nombre.toLowerCase().includes(query.toLowerCase()) ||
      r.sku.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} productos · stock en tiempo real
          </p>
        </div>
        {canEdit && <NuevoProductoDialog onCreated={() => router.refresh()} />}
      </div>

      <Input
        placeholder="Buscar por SKU o nombre…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {/* Vista tabla (md+) */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Producto</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 text-right font-medium">Stock</th>
                <th className="px-4 py-2 text-right font-medium">Mínimo</th>
                <th className="px-4 py-2 text-right font-medium">Precio</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const low = row.stock <= row.stock_minimo;
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-4 py-2">{row.nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground">{row.categoria ?? '—'}</td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${low ? 'text-destructive' : ''}`}
                    >
                      {row.stock.toFixed(2)} {row.unidad}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {row.stock_minimo.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.tipo_unidad === 'weight' ? (
                        <>
                          {formatCurrency(row.precio_libra ?? 0)}
                          <span className="text-xs text-muted-foreground"> /lb</span>
                        </>
                      ) : (
                        formatCurrency(row.precio_base)
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2 text-right">
                        <AjustarStockDialog
                          productoId={row.id}
                          productoNombre={row.nombre}
                          onApplied={() => router.refresh()}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista lista (móvil) */}
      <ul className="space-y-2 md:hidden">
        {filtered.map((row) => {
          const low = row.stock <= row.stock_minimo;
          return (
            <li key={row.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{row.nombre}</div>
                  <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                  {row.categoria && (
                    <div className="text-xs text-muted-foreground">{row.categoria}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${low ? 'text-destructive' : ''}`}>
                    {row.stock.toFixed(2)} {row.unidad}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    mín {row.stock_minimo.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm">
                  {row.tipo_unidad === 'weight'
                    ? `${formatCurrency(row.precio_libra ?? 0)} /lb`
                    : formatCurrency(row.precio_base)}
                </span>
                {canEdit && (
                  <AjustarStockDialog
                    productoId={row.id}
                    productoNombre={row.nombre}
                    onApplied={() => router.refresh()}
                  />
                )}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
            Sin resultados
          </li>
        )}
      </ul>
    </div>
  );
}
