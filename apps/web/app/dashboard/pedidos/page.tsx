import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth/role';
import { PedidosAdminClient } from './_components/pedidos-admin-client';
import {
  PedidosVendedorClient,
  type PedidoListItem,
  type ClienteOpt,
  type ProductoOpt,
  type VendedorOpt,
} from './_components/pedidos-vendedor-client';

export const dynamic = 'force-dynamic';

export default async function PedidosPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const role = ctx?.role ?? 'vendedor';

  const [{ data: pedidos }, { data: clientes }, { data: productos }, { data: vendedores }] =
    await Promise.all([
      supabase
        .from('pedidos')
        .select(
          'id, cliente_id, vendedor_id, fecha_entrega, estado, notas, venta_id, created_at, ' +
            'cliente:clientes(id, nombre), ' +
            'vendedor:profiles!pedidos_vendedor_id_fkey(id, full_name), ' +
            'items:pedido_items(id, producto_id, cantidad_estimada, cantidad_final, precio_unitario, notas, producto:productos(id, sku, nombre, tipo_unidad, unidad, precio_base, precio_libra, inventario(stock)))',
        )
        .order('fecha_entrega', { ascending: true }),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
      supabase
        .from('productos')
        .select(
          'id, sku, nombre, tipo_unidad, unidad, precio_base, precio_libra, inventario(stock)',
        )
        .eq('activo', true)
        .order('nombre'),
      // Solo admin necesita la lista de vendedores. Vendedor no la requiere y
      // RLS de profiles_select_self_or_admin la devolvería vacía igual.
      role === 'admin'
        ? supabase.from('profiles').select('id, full_name').eq('role', 'vendedor').order('full_name')
        : Promise.resolve({ data: [] }),
    ]);

  const pedidosList: PedidoListItem[] = ((pedidos ?? []) as any[]).map((p) => ({
    id: p.id,
    cliente_id: p.cliente_id,
    cliente_nombre: p.cliente?.nombre ?? '—',
    vendedor_id: p.vendedor_id,
    vendedor_nombre: p.vendedor?.full_name ?? '—',
    fecha_entrega: p.fecha_entrega,
    estado: p.estado,
    notas: p.notas,
    venta_id: p.venta_id,
    created_at: p.created_at,
    items: ((p.items ?? []) as any[]).map((it) => {
      const prod = it.producto;
      const inv = Array.isArray(prod?.inventario) ? prod.inventario[0] : prod?.inventario;
      return {
        id: it.id,
        producto_id: it.producto_id,
        producto_sku: prod?.sku ?? '',
        producto_nombre: prod?.nombre ?? '—',
        tipo_unidad: (prod?.tipo_unidad ?? 'unit') as 'unit' | 'weight',
        unidad: prod?.unidad ?? 'unidad',
        cantidad_estimada: Number(it.cantidad_estimada),
        cantidad_final: it.cantidad_final == null ? null : Number(it.cantidad_final),
        precio_unitario: Number(it.precio_unitario),
        stock_actual: Number(inv?.stock ?? 0),
        notas: it.notas,
      };
    }),
  }));

  const clientesOpt: ClienteOpt[] = ((clientes ?? []) as any[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
  }));

  const productosOpt: ProductoOpt[] = ((productos ?? []) as any[]).map((p) => {
    const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      tipo_unidad: (p.tipo_unidad ?? 'unit') as 'unit' | 'weight',
      unidad: p.unidad,
      precio_base: Number(p.precio_base),
      precio_libra: p.precio_libra == null ? null : Number(p.precio_libra),
      stock: Number(inv?.stock ?? 0),
    };
  });

  const vendedoresOpt: VendedorOpt[] = ((vendedores ?? []) as any[]).map((v) => ({
    id: v.id,
    nombre: v.full_name ?? '—',
  }));

  if (role === 'admin') {
    return (
      <PedidosAdminClient
        pedidos={pedidosList}
        clientes={clientesOpt}
        productos={productosOpt}
        vendedores={vendedoresOpt}
      />
    );
  }

  const misPedidos = pedidosList.filter((p) => p.vendedor_id === ctx?.user.id);
  return (
    <PedidosVendedorClient
      pedidos={misPedidos}
      productos={productosOpt}
      vendedorId={ctx?.user.id ?? ''}
    />
  );
}
