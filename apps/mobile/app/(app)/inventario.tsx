import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { clearLocalSession } from '@/lib/auth/pin';
import { getCompanyId, useSession } from '@/lib/auth/session';

type Row = {
  id: string;
  sku: string;
  nombre: string;
  unidad: string;
  stock: number;
  precio_base: number;
};

export default function InventarioScreen() {
  const { session } = useSession();
  const companyId = useMemo(() => getCompanyId(session), [session]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  async function fetchRows() {
    const { data, error } = await supabase
      .from('productos')
      .select('id, sku, nombre, unidad, precio_base, inventario(stock)')
      .order('nombre', { ascending: true });
    if (error) {
      console.warn('inventario error', error);
      setRows([]);
      return;
    }
    setRows(
      (data ?? []).map((p) => {
        const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
        return {
          id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          unidad: p.unidad,
          precio_base: Number(p.precio_base),
          stock: Number(inv?.stock ?? 0),
        };
      }),
    );
  }

  useEffect(() => {
    fetchRows().finally(() => setLoading(false));
  }, []);

  // Realtime: actualizar stock en vivo.
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`inv-${companyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventario' },
        (payload) => {
          const next = payload.new as { producto_id: string; stock: number };
          setRows((prev) =>
            prev.map((r) => (r.id === next.producto_id ? { ...r, stock: Number(next.stock) } : r)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const filtered = rows.filter(
    (r) =>
      !query ||
      r.nombre.toLowerCase().includes(query.toLowerCase()) ||
      r.sku.toLowerCase().includes(query.toLowerCase()),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar SKU o nombre"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchRows();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.sku}>{item.sku}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.stock}>
                {item.stock.toFixed(2)} {item.unidad}
              </Text>
              <Text style={styles.price}>${item.precio_base.toFixed(2)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin productos</Text>}
      />
      <Button
        title="Cerrar sesión"
        onPress={async () => {
          await clearLocalSession();
          router.replace('/(auth)/login');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  name: { fontSize: 16, fontWeight: '600' },
  sku: { fontSize: 12, color: '#777', marginTop: 2 },
  stock: { fontSize: 16, fontWeight: '600' },
  price: { fontSize: 12, color: '#777', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
});
