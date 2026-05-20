import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useVentaStore } from '@/stores/venta-store';
import { getCompanyId, useSession } from '@/lib/auth/session';

type Producto = {
  id: string;
  sku: string;
  nombre: string;
  precio_base: number;
  stock: number;
};
type Cliente = { id: string; nombre: string };

const METODOS: Array<{ value: 'efectivo' | 'transferencia' | 'credito'; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'credito', label: 'Crédito' },
];

export default function NuevaVentaScreen() {
  const { session } = useSession();
  const companyId = getCompanyId(session);
  const store = useVentaStore();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [tab, setTab] = useState<'items' | 'resumen'>('items');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('productos').select('id, sku, nombre, precio_base, inventario(stock)').order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    ]).then(([{ data: prods }, { data: clts }]) => {
      setProductos(
        (prods ?? []).map((p) => {
          const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
          return { id: p.id, sku: p.sku, nombre: p.nombre, precio_base: Number(p.precio_base), stock: Number(inv?.stock ?? 0) };
        }),
      );
      setClientes(clts ?? []);
    });
  }, []);

  // Carga precio personalizado para el cliente seleccionado cuando cambia.
  async function getPrecioParaCliente(productoId: string, precioBase: number): Promise<number> {
    if (!store.clienteId) return precioBase;
    const { data } = await supabase.rpc('precio_efectivo', {
      p_cliente_id: store.clienteId,
      p_producto_id: productoId,
    });
    return Number(data ?? precioBase);
  }

  async function agregarItem(producto: Producto, cantidadStr: string) {
    const cantidad = parseFloat(cantidadStr);
    if (!cantidad || cantidad <= 0) { Alert.alert('Cantidad inválida'); return; }
    if (cantidad > producto.stock) {
      Alert.alert('Stock insuficiente', `Disponible: ${producto.stock.toFixed(2)} kg`);
      return;
    }
    const precio = await getPrecioParaCliente(producto.id, producto.precio_base);
    store.addItem({ producto_id: producto.id, nombre: producto.nombre, sku: producto.sku, cantidad, precio_unitario: precio });
  }

  async function handleConfirmar() {
    if (store.items.length === 0) { Alert.alert('Agrega al menos un producto'); return; }
    if (!session?.user?.id || !companyId) { Alert.alert('Sesión inválida'); return; }
    setSubmitting(true);
    try {
      // Crear venta en borrador.
      const { data: venta, error: ventaErr } = await supabase
        .from('ventas')
        .insert({
          company_id: companyId,
          vendedor_id: session.user.id,
          cliente_id: store.clienteId ?? undefined,
          fecha: new Date().toISOString().slice(0, 10),
          metodo_pago: store.metodoPago,
          descuento: store.descuento,
        })
        .select('id')
        .single();
      if (ventaErr || !venta) throw new Error(ventaErr?.message ?? 'Error al crear venta');

      // Insertar ítems.
      const items = store.items.map((i) => ({
        venta_id: venta.id,
        company_id: companyId,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }));
      const { error: itemsErr } = await supabase.from('venta_items').insert(items);
      if (itemsErr) throw new Error(itemsErr.message);

      // Confirmar (descontará stock).
      const { error: confErr } = await supabase.rpc('confirmar_venta', { p_venta_id: venta.id });
      if (confErr) throw new Error(confErr.message);

      store.reset();
      Alert.alert('Venta confirmada', `Total: S/ ${store.total().toFixed(2)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const productosFiltrados = productos.filter(
    (p) =>
      !busquedaProducto ||
      p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
      p.sku.toLowerCase().includes(busquedaProducto.toLowerCase()),
  );
  const clientesFiltrados = clientes.filter(
    (c) => !busquedaCliente || c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()),
  );

  return (
    <View style={s.container}>
      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'items' && s.tabActive]}
          onPress={() => setTab('items')}
        >
          <Text style={[s.tabText, tab === 'items' && s.tabTextActive]}>
            Productos ({store.items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'resumen' && s.tabActive]}
          onPress={() => setTab('resumen')}
        >
          <Text style={[s.tabText, tab === 'resumen' && s.tabTextActive]}>Resumen</Text>
        </TouchableOpacity>
      </View>

      {tab === 'items' ? (
        <View style={{ flex: 1 }}>
          <TextInput
            style={s.search}
            placeholder="Buscar producto…"
            value={busquedaProducto}
            onChangeText={setBusquedaProducto}
          />
          <FlatList
            data={productosFiltrados}
            keyExtractor={(p) => p.id}
            renderItem={({ item: p }) => {
              const enCarrito = store.items.find((i) => i.producto_id === p.id);
              return (
                <ProductoRow
                  producto={p}
                  enCarrito={enCarrito?.cantidad}
                  onAgregar={(cant) => agregarItem(p, cant)}
                  onQuitar={() => store.removeItem(p.id)}
                />
              );
            }}
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {/* Cliente */}
          <Text style={s.sectionTitle}>Cliente</Text>
          <TextInput
            style={s.search}
            placeholder="Buscar cliente…"
            value={busquedaCliente}
            onChangeText={setBusquedaCliente}
          />
          {(busquedaCliente ? clientesFiltrados : []).slice(0, 5).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[s.clienteRow, store.clienteId === c.id && s.clienteSelected]}
              onPress={() => {
                store.setCliente(c.id, c.nombre);
                setBusquedaCliente('');
              }}
            >
              <Text>{c.nombre}</Text>
            </TouchableOpacity>
          ))}
          {store.clienteNombre && (
            <View style={s.clienteRow}>
              <Text style={{ fontWeight: '600' }}>{store.clienteNombre}</Text>
              <TouchableOpacity onPress={() => store.setCliente(null, null)}>
                <Text style={{ color: '#ef4444' }}>Quitar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Método de pago */}
          <Text style={s.sectionTitle}>Método de pago</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {METODOS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[s.metodoPill, store.metodoPago === m.value && s.metodoPillActive]}
                onPress={() => store.setMetodoPago(m.value)}
              >
                <Text style={{ color: store.metodoPago === m.value ? '#fff' : '#333' }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ítems */}
          <Text style={s.sectionTitle}>Ítems</Text>
          {store.items.map((item) => (
            <View key={item.producto_id} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{item.nombre}</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>
                  {item.cantidad.toFixed(2)} × S/ {item.precio_unitario.toFixed(2)}
                </Text>
              </View>
              <Text>S/ {(item.cantidad * item.precio_unitario).toFixed(2)}</Text>
            </View>
          ))}

          {/* Totales */}
          <View style={s.totalesBox}>
            <View style={s.totalRow}>
              <Text style={{ color: '#666' }}>Subtotal</Text>
              <Text>S/ {store.subtotal().toFixed(2)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={{ color: '#666' }}>Descuento</Text>
              <TextInput
                style={s.descuentoInput}
                keyboardType="decimal-pad"
                value={String(store.descuento)}
                onChangeText={(v) => store.setDescuento(parseFloat(v) || 0)}
              />
            </View>
            <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }]}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>Total</Text>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>
                S/ {store.total().toFixed(2)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.btn, submitting && { opacity: 0.6 }]}
            onPress={handleConfirmar}
            disabled={submitting}
          >
            <Text style={s.btnText}>{submitting ? 'Procesando…' : 'Confirmar venta'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function ProductoRow({
  producto,
  enCarrito,
  onAgregar,
  onQuitar,
}: {
  producto: Producto;
  enCarrito?: number;
  onAgregar: (cant: string) => void;
  onQuitar: () => void;
}) {
  const [cant, setCant] = useState('1');
  return (
    <View style={s.productoRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{producto.nombre}</Text>
        <Text style={{ color: '#666', fontSize: 12 }}>
          {producto.sku} · Stock: {producto.stock.toFixed(2)} · S/ {producto.precio_base.toFixed(2)}
        </Text>
        {enCarrito !== undefined && (
          <Text style={{ color: '#2563eb', fontSize: 12 }}>En carrito: {enCarrito.toFixed(2)}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          style={s.cantInput}
          keyboardType="decimal-pad"
          value={cant}
          onChangeText={setCant}
        />
        <TouchableOpacity style={s.addBtn} onPress={() => onAgregar(cant)}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>+</Text>
        </TouchableOpacity>
        {enCarrito !== undefined && (
          <TouchableOpacity style={s.removeBtn} onPress={onQuitar}>
            <Text style={{ color: '#ef4444' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { color: '#666' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  search: { margin: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8 },
  productoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  cantInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 4, width: 52, textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#2563eb', borderRadius: 6,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  removeBtn: { padding: 4 },
  sectionTitle: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 4, fontWeight: '700', color: '#444' },
  clienteRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginHorizontal: 12, padding: 10, borderWidth: 1, borderColor: '#eee',
    borderRadius: 8, marginBottom: 4,
  },
  clienteSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  metodoPill: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center', marginLeft: 12,
  },
  metodoPillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  totalesBox: { margin: 12, padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  descuentoInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 2, width: 80, textAlign: 'right',
  },
  btn: {
    margin: 12, backgroundColor: '#2563eb', paddingVertical: 14,
    borderRadius: 8, alignItems: 'center', marginBottom: 32,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
