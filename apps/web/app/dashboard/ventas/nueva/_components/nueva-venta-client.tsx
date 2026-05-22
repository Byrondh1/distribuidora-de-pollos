'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, cn } from '@/lib/utils';

export type ProductoOpt = {
  id: string;
  sku: string;
  nombre: string;
  precio_base: number;
  precio_libra: number | null;
  tipo_unidad: 'unit' | 'weight';
  unidad: string;
  stock: number;
};

export type ClienteOpt = { id: string; nombre: string };

type Item = {
  producto_id: string;
  sku: string;
  nombre: string;
  tipo_unidad: 'unit' | 'weight';
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  precio_base_ref: number;
};

type Metodo = 'efectivo' | 'transferencia' | 'credito';
type Paso = 'cliente' | 'productos' | 'resumen';

const METODOS: { value: Metodo; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'credito', label: 'Crédito' },
];

export function NuevaVentaClient({
  productos,
  topProductos,
  clientes,
}: {
  productos: ProductoOpt[];
  topProductos: ProductoOpt[];
  clientes: ClienteOpt[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [paso, setPaso] = useState<Paso>('cliente');
  const [cliente, setCliente] = useState<ClienteOpt | null>(null);
  const [sinCliente, setSinCliente] = useState(false);
  const [busquedaCli, setBusquedaCli] = useState('');

  const [items, setItems] = useState<Item[]>([]);
  const [busquedaProd, setBusquedaProd] = useState('');

  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const clienteResuelto = sinCliente || cliente !== null;

  const clientesFiltrados = clientes.filter(
    (c) => !busquedaCli || c.nombre.toLowerCase().includes(busquedaCli.toLowerCase()),
  );
  const productosFiltrados = productos.filter(
    (p) =>
      !busquedaProd ||
      p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
      p.sku.toLowerCase().includes(busquedaProd.toLowerCase()),
  );

  async function precioInicial(producto: ProductoOpt): Promise<number> {
    const base =
      producto.tipo_unidad === 'weight' ? producto.precio_libra ?? 0 : producto.precio_base;
    if (!cliente) return base;
    const { data } = await supabase.rpc('precio_efectivo', {
      p_cliente_id: cliente.id,
      p_producto_id: producto.id,
    });
    const custom = Number(data ?? 0);
    return custom > 0 ? custom : base;
  }

  async function agregarRapido(producto: ProductoOpt) {
    const yaEnCarrito = items.find((i) => i.producto_id === producto.id);
    if (yaEnCarrito) {
      quitar(producto.id);
      return;
    }
    const precio = await precioInicial(producto);
    await agregar(producto, 1, precio);
  }

  async function agregar(producto: ProductoOpt, cantidad: number, precio: number) {
    if (!cantidad || cantidad <= 0) {
      alert('Cantidad inválida');
      return;
    }
    if (cantidad > producto.stock) {
      alert(
        `Stock insuficiente. Disponible: ${producto.stock.toFixed(2)} ${
          producto.tipo_unidad === 'weight' ? 'lb' : producto.unidad
        }`,
      );
      return;
    }
    if (!precio || precio < 0) {
      alert('Precio inválido');
      return;
    }
    const base =
      producto.tipo_unidad === 'weight' ? producto.precio_libra ?? 0 : producto.precio_base;
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.producto_id === producto.id);
      const next: Item = {
        producto_id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        tipo_unidad: producto.tipo_unidad,
        unidad: producto.tipo_unidad === 'weight' ? 'lb' : producto.unidad,
        cantidad,
        precio_unitario: precio,
        precio_base_ref: base,
      };
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = next;
        return copy;
      }
      return [...prev, next];
    });
  }

  function quitar(productoId: string) {
    setItems((prev) => prev.filter((i) => i.producto_id !== productoId));
  }

  async function confirmar() {
    setError(null);
    if (items.length === 0) {
      setError('Agrega al menos un producto.');
      setPaso('productos');
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const companyId = user?.app_metadata?.company_id as string | undefined;
      if (!user || !companyId) throw new Error('Sesión inválida');

      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .insert({
          company_id: companyId,
          vendedor_id: user.id,
          cliente_id: cliente?.id ?? null,
          fecha: new Date().toISOString().slice(0, 10),
          metodo_pago: metodo,
          descuento: 0,
        } as any)
        .select('id')
        .single();
      if (errV || !venta) throw new Error(errV?.message ?? 'No se pudo crear la venta');

      const itemsPayload = items.map((i) => ({
        venta_id: venta.id,
        company_id: companyId,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }));
      const { error: errI } = await supabase.from('venta_items').insert(itemsPayload as any);
      if (errI) throw new Error(errI.message);

      const { error: errC } = await supabase.rpc('confirmar_venta', { p_venta_id: venta.id });
      if (errC) throw new Error(errC.message);

      router.push('/dashboard/ventas');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Nueva venta</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} producto{items.length === 1 ? '' : 's'} · {formatCurrency(total)}
        </p>
      </div>

      <Stepper paso={paso} onChange={setPaso} clienteOk={clienteResuelto} itemsOk={items.length > 0} />

      {paso === 'cliente' && (
        <PasoCliente
          cliente={cliente}
          sinCliente={sinCliente}
          busqueda={busquedaCli}
          setBusqueda={setBusquedaCli}
          clientes={clientesFiltrados}
          onElegir={(c) => {
            setCliente(c);
            setSinCliente(false);
            setBusquedaCli('');
          }}
          onSinCliente={() => {
            setCliente(null);
            setSinCliente(true);
          }}
          onContinuar={() => setPaso('productos')}
        />
      )}

      {paso === 'productos' && (
        <PasoProductos
          productos={productosFiltrados}
          topProductos={topProductos}
          items={items}
          busqueda={busquedaProd}
          setBusqueda={setBusquedaProd}
          precioInicial={precioInicial}
          onAgregar={agregar}
          onAgregarRapido={agregarRapido}
          onQuitar={quitar}
          onAtras={() => setPaso('cliente')}
          onContinuar={() => setPaso('resumen')}
        />
      )}

      {paso === 'resumen' && (
        <PasoResumen
          cliente={cliente}
          sinCliente={sinCliente}
          items={items}
          metodo={metodo}
          total={total}
          submitting={submitting}
          error={error}
          onSetMetodo={setMetodo}
          onQuitarItem={quitar}
          onAtras={() => setPaso('productos')}
          onConfirmar={confirmar}
        />
      )}
    </div>
  );
}

function Stepper({
  paso,
  onChange,
  clienteOk,
  itemsOk,
}: {
  paso: Paso;
  onChange: (p: Paso) => void;
  clienteOk: boolean;
  itemsOk: boolean;
}) {
  const steps: { id: Paso; label: string; n: number; locked: boolean }[] = [
    { id: 'cliente', label: 'Cliente', n: 1, locked: false },
    { id: 'productos', label: 'Productos', n: 2, locked: !clienteOk },
    { id: 'resumen', label: 'Resumen', n: 3, locked: !clienteOk || !itemsOk },
  ];
  return (
    <ol className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-muted/30 p-2">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <button
            type="button"
            disabled={s.locked}
            onClick={() => onChange(s.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
              paso === s.id
                ? 'bg-primary text-primary-foreground'
                : s.locked
                  ? 'cursor-not-allowed text-muted-foreground'
                  : 'hover:bg-background',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                paso === s.id ? 'bg-primary-foreground text-primary' : 'bg-muted-foreground/30',
              )}
            >
              {s.n}
            </span>
            {s.label}
          </button>
          {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

function PasoCliente({
  cliente,
  sinCliente,
  busqueda,
  setBusqueda,
  clientes,
  onElegir,
  onSinCliente,
  onContinuar,
}: {
  cliente: ClienteOpt | null;
  sinCliente: boolean;
  busqueda: string;
  setBusqueda: (v: string) => void;
  clientes: ClienteOpt[];
  onElegir: (c: ClienteOpt) => void;
  onSinCliente: () => void;
  onContinuar: () => void;
}) {
  const seleccion = cliente !== null || sinCliente;
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-base">Paso 1 · Seleccionar cliente</Label>
        <p className="text-sm text-muted-foreground">
          Busca un cliente o continúa como venta al contado.
        </p>
      </div>

      <button
        type="button"
        onClick={onSinCliente}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-left text-sm',
          sinCliente ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
        )}
      >
        Sin cliente · venta al contado
      </button>

      <div className="space-y-2">
        <Input
          placeholder="Buscar cliente por nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <ul className="max-h-60 divide-y overflow-y-auto rounded-md border">
            {clientes.slice(0, 20).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onElegir(c)}
                  className={cn(
                    'block w-full px-3 py-2 text-left text-sm hover:bg-muted',
                    cliente?.id === c.id && 'bg-primary/10 font-medium',
                  )}
                >
                  {c.nombre}
                </button>
              </li>
            ))}
            {clientes.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
            )}
          </ul>
        )}
        {cliente && (
          <div className="rounded-md border bg-primary/10 px-3 py-2 text-sm">
            <span className="font-medium">{cliente.nombre}</span> seleccionado
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinuar} disabled={!seleccion}>
          Continuar a productos
        </Button>
      </div>
    </section>
  );
}

function PasoProductos({
  productos,
  topProductos,
  items,
  busqueda,
  setBusqueda,
  precioInicial,
  onAgregar,
  onAgregarRapido,
  onQuitar,
  onAtras,
  onContinuar,
}: {
  productos: ProductoOpt[];
  topProductos: ProductoOpt[];
  items: Item[];
  busqueda: string;
  setBusqueda: (v: string) => void;
  precioInicial: (p: ProductoOpt) => Promise<number>;
  onAgregar: (p: ProductoOpt, cantidad: number, precio: number) => Promise<void>;
  onAgregarRapido: (p: ProductoOpt) => Promise<void>;
  onQuitar: (productoId: string) => void;
  onAtras: () => void;
  onContinuar: () => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-base">Paso 2 · Agregar productos</Label>
        <p className="text-sm text-muted-foreground">
          Toca un frecuente para agregarlo rápido, o busca y ajusta cantidad y precio.
        </p>
      </div>

      {topProductos.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Frecuentes
            </span>
            <span className="text-[10px] text-muted-foreground">
              últimos 60 días · tocar para agregar
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {topProductos.map((p) => {
              const inCart = items.find((i) => i.producto_id === p.id);
              return (
                <QuickCard
                  key={p.id}
                  producto={p}
                  enCarrito={inCart}
                  onTap={() => onAgregarRapido(p)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <Input
          placeholder="Buscar producto por nombre o SKU…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <ul className="divide-y rounded-lg border">
        {productos.map((p) => (
          <ProductoRow
            key={p.id}
            producto={p}
            enCarrito={items.find((i) => i.producto_id === p.id)}
            precioInicial={precioInicial}
            onAgregar={onAgregar}
            onQuitar={() => onQuitar(p.id)}
          />
        ))}
        {productos.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Sin productos</li>
        )}
      </ul>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onAtras}>
          ← Atrás
        </Button>
        <Button onClick={onContinuar} disabled={items.length === 0}>
          Continuar al resumen ({items.length})
        </Button>
      </div>
    </section>
  );
}

function ProductoRow({
  producto,
  enCarrito,
  precioInicial,
  onAgregar,
  onQuitar,
}: {
  producto: ProductoOpt;
  enCarrito: Item | undefined;
  precioInicial: (p: ProductoOpt) => Promise<number>;
  onAgregar: (p: ProductoOpt, cantidad: number, precio: number) => Promise<void>;
  onQuitar: () => void;
}) {
  const esPorPeso = producto.tipo_unidad === 'weight';
  const precioBase = esPorPeso ? producto.precio_libra ?? 0 : producto.precio_base;
  const sufijoUnidad = esPorPeso ? 'lb' : producto.unidad;
  const labelPrecio = esPorPeso ? 'Precio /lb' : 'Precio /unidad';
  const labelCantidad = esPorPeso ? 'Libras' : 'Cantidad';

  const [cantidad, setCantidad] = useState<string>(enCarrito ? String(enCarrito.cantidad) : '');
  const [precio, setPrecio] = useState<string>(
    enCarrito ? String(enCarrito.precio_unitario) : String(precioBase),
  );

  async function inicializarPrecio() {
    if (enCarrito) return;
    const p = await precioInicial(producto);
    setPrecio(String(p));
  }

  const subtotal = (parseFloat(cantidad) || 0) * (parseFloat(precio) || 0);

  return (
    <li className="space-y-3 px-3 py-3" onFocus={inicializarPrecio}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{producto.nombre}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                esPorPeso ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900',
              )}
            >
              {esPorPeso ? 'Por libra' : 'Por unidad'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {producto.sku} · Stock {producto.stock.toFixed(2)} {sufijoUnidad} · Base{' '}
            {formatCurrency(precioBase)}
            {esPorPeso ? '/lb' : ''}
          </div>
          {enCarrito && (
            <div className="mt-1 text-xs text-primary">
              En venta: {enCarrito.cantidad.toFixed(2)} {sufijoUnidad} ×{' '}
              {formatCurrency(enCarrito.precio_unitario)} ={' '}
              {formatCurrency(enCarrito.cantidad * enCarrito.precio_unitario)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:max-w-md">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">{labelCantidad}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={esPorPeso ? '3.54' : '1'}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">{labelPrecio}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="flex flex-col justify-end">
          <Button
            size="sm"
            onClick={() => onAgregar(producto, parseFloat(cantidad) || 0, parseFloat(precio) || 0)}
          >
            {enCarrito ? 'Actualizar' : 'Agregar'}
          </Button>
        </div>
      </div>

      {(parseFloat(cantidad) || 0) > 0 && (
        <div className="text-xs text-muted-foreground">
          Subtotal estimado: <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
      )}

      {enCarrito && (
        <Button size="sm" variant="ghost" onClick={onQuitar} className="text-destructive">
          Quitar de la venta
        </Button>
      )}
    </li>
  );
}

function PasoResumen({
  cliente,
  sinCliente,
  items,
  metodo,
  total,
  submitting,
  error,
  onSetMetodo,
  onQuitarItem,
  onAtras,
  onConfirmar,
}: {
  cliente: ClienteOpt | null;
  sinCliente: boolean;
  items: Item[];
  metodo: Metodo;
  total: number;
  submitting: boolean;
  error: string | null;
  onSetMetodo: (m: Metodo) => void;
  onQuitarItem: (productoId: string) => void;
  onAtras: () => void;
  onConfirmar: () => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-base">Paso 3 · Resumen</Label>
        <p className="text-sm text-muted-foreground">Confirma los datos antes de procesar.</p>
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Cliente:</span>{' '}
        <span className="font-medium">
          {cliente ? cliente.nombre : sinCliente ? 'Sin cliente · venta al contado' : '—'}
        </span>
      </div>

      <div className="rounded-md border">
        <header className="border-b px-3 py-2 text-sm font-medium">
          Ítems ({items.length})
        </header>
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.producto_id} className="space-y-1 px-3 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{i.nombre}</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                        i.tipo_unidad === 'weight'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-blue-900',
                      )}
                    >
                      {i.tipo_unidad === 'weight' ? 'Por libra' : 'Por unidad'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.cantidad.toFixed(2)} {i.unidad} ×{' '}
                    {formatCurrency(i.precio_unitario)}
                    {i.tipo_unidad === 'weight' ? '/lb' : ''}
                    {i.precio_unitario !== i.precio_base_ref && (
                      <span className="ml-1 text-amber-700">
                        (base {formatCurrency(i.precio_base_ref)})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatCurrency(i.cantidad * i.precio_unitario)}
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuitarItem(i.producto_id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sin ítems</li>
          )}
        </ul>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Método de pago</Label>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onSetMetodo(m.value)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium',
                metodo === m.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={onAtras} disabled={submitting}>
          ← Atrás
        </Button>
        <Button onClick={onConfirmar} disabled={submitting || items.length === 0}>
          {submitting ? 'Procesando…' : 'Confirmar venta'}
        </Button>
      </div>
    </section>
  );
}

function QuickCard({
  producto,
  enCarrito,
  onTap,
}: {
  producto: ProductoOpt;
  enCarrito: Item | undefined;
  onTap: () => void;
}) {
  const esPorPeso = producto.tipo_unidad === 'weight';
  const precioBase = esPorPeso ? producto.precio_libra ?? 0 : producto.precio_base;
  const sufijo = esPorPeso ? '/lb' : '';
  const activo = Boolean(enCarrito);
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        'relative flex flex-col gap-1 rounded-lg border p-3 text-left transition',
        activo
          ? 'border-primary bg-primary/10'
          : 'hover:border-primary/40 hover:bg-muted',
      )}
    >
      {activo && (
        <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          ✓ {enCarrito!.cantidad.toFixed(esPorPeso ? 2 : 0)}
        </span>
      )}
      <span
        className={cn(
          'inline-block w-fit rounded px-1.5 py-0.5 text-[9px] font-medium uppercase',
          esPorPeso ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900',
        )}
      >
        {esPorPeso ? 'Libra' : 'Unidad'}
      </span>
      <span className="line-clamp-2 text-sm font-medium leading-tight">{producto.nombre}</span>
      <span className="text-xs text-muted-foreground">
        {formatCurrency(precioBase)}
        {sufijo}
      </span>
      {activo && (
        <span className="text-[10px] text-muted-foreground">tocar para quitar</span>
      )}
    </button>
  );
}
