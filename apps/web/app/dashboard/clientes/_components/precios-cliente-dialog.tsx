'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type ProductoPrecio = {
  id: string;
  sku: string;
  nombre: string;
  precio_base: number;
  precio_custom: number | null;
  precio_custom_id: string | null;
};

export function PreciosClienteDialog({
  clienteId,
  clienteNombre,
}: {
  clienteId: string;
  clienteNombre: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ProductoPrecio[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: productos }, { data: precios }] = await Promise.all([
        supabase.from('productos').select('id, sku, nombre, precio_base').order('nombre'),
        supabase.from('precios_cliente').select('id, producto_id, precio').eq('cliente_id', clienteId),
      ]);
      const preciosMap = new Map((precios ?? []).map((p) => [p.producto_id, p]));
      setRows(
        (productos ?? []).map((p) => {
          const custom = preciosMap.get(p.id);
          return {
            id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            precio_base: Number(p.precio_base),
            precio_custom: custom ? Number(custom.precio) : null,
            precio_custom_id: custom?.id ?? null,
          };
        }),
      );
      const d: Record<string, string> = {};
      (productos ?? []).forEach((p) => {
        const custom = preciosMap.get(p.id);
        d[p.id] = custom ? String(custom.precio) : '';
      });
      setDraft(d);
    })();
  }, [open, clienteId, supabase]);

  async function handleSave(productoId: string) {
    const val = draft[productoId]?.trim();
    setSaving(productoId);
    const { data: { user } } = await supabase.auth.getUser();
    const companyId = user?.app_metadata?.company_id as string | undefined;
    if (!companyId) { setSaving(null); return; }

    const row = rows.find((r) => r.id === productoId);
    if (!row) { setSaving(null); return; }

    if (!val) {
      // Borrar precio personalizado si existe.
      if (row.precio_custom_id) {
        await supabase.from('precios_cliente').delete().eq('id', row.precio_custom_id);
        setRows((prev) => prev.map((r) => r.id === productoId ? { ...r, precio_custom: null, precio_custom_id: null } : r));
      }
    } else {
      const precio = parseFloat(val);
      if (isNaN(precio) || precio < 0) { setSaving(null); return; }
      if (row.precio_custom_id) {
        await supabase.from('precios_cliente').update({ precio }).eq('id', row.precio_custom_id);
        setRows((prev) => prev.map((r) => r.id === productoId ? { ...r, precio_custom: precio } : r));
      } else {
        const { data } = await supabase.from('precios_cliente').insert({
          company_id: companyId,
          cliente_id: clienteId,
          producto_id: productoId,
          precio,
        }).select('id').single();
        setRows((prev) => prev.map((r) => r.id === productoId ? { ...r, precio_custom: precio, precio_custom_id: data?.id ?? null } : r));
      }
    }
    setSaving(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Precios</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Precios personalizados</DialogTitle>
          <DialogDescription>{clienteNombre} — deja vacío para usar precio base.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="py-2 text-left">Producto</th>
                <th className="py-2 text-right">Base</th>
                <th className="py-2 text-right">Personalizado</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">
                    <div className="font-medium">{r.nombre}</div>
                    <div className="text-xs text-muted-foreground">{r.sku}</div>
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    S/ {r.precio_base.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8 w-28 text-right"
                      placeholder={r.precio_base.toFixed(2)}
                      value={draft[r.id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 pl-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving === r.id}
                      onClick={() => handleSave(r.id)}
                    >
                      {saving === r.id ? '…' : 'Guardar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
