'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NuevoClienteDialog } from './nuevo-cliente-dialog';
import { PreciosClienteDialog } from './precios-cliente-dialog';
import { useRouter } from 'next/navigation';

type ClienteRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  ruc: string | null;
  limite_credito: number;
  activo: boolean;
};

export function ClientesClient({ initialRows }: { initialRows: ClienteRow[] }) {
  const router = useRouter();
  const [rows] = useState(initialRows);
  const [query, setQuery] = useState('');

  const filtered = rows.filter(
    (r) =>
      !query ||
      r.nombre.toLowerCase().includes(query.toLowerCase()) ||
      (r.ruc ?? '').includes(query) ||
      (r.telefono ?? '').includes(query),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{rows.length} clientes registrados</p>
        </div>
        <NuevoClienteDialog onCreated={() => router.refresh()} />
      </div>
      <Input
        placeholder="Buscar por nombre, RUC o teléfono…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">RUC</th>
              <th className="px-4 py-2 font-medium">Teléfono</th>
              <th className="px-4 py-2 text-right font-medium">Límite crédito</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.nombre}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {r.ruc ?? '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.telefono ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  {r.limite_credito > 0
                    ? `S/ ${Number(r.limite_credito).toFixed(2)}`
                    : <span className="text-muted-foreground">Sin crédito</span>}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}
                  >
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <PreciosClienteDialog clienteId={r.id} clienteNombre={r.nombre} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
