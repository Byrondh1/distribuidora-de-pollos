import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/session';

type DespachoItem = {
  id: string;
  estado: 'pendiente' | 'entregado' | 'fallido';
  notas: string | null;
  venta: { id: string; total: number; cliente: string | null } | null;
};

type Despacho = {
  id: string;
  fecha: string;
  estado: 'pendiente' | 'en_ruta' | 'entregado' | 'fallido';
  items: DespachoItem[];
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente:  { bg: '#fef9c3', text: '#854d0e' },
  en_ruta:    { bg: '#dbeafe', text: '#1e40af' },
  entregado:  { bg: '#dcfce7', text: '#166534' },
  fallido:    { bg: '#fee2e2', text: '#991b1b' },
};

export default function DespachoScreen() {
  const { session } = useSession();
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function fetchDespachos() {
    if (!session) return;
    const { data } = await supabase
      .from('despachos')
      .select(`
        id, fecha, estado,
        despacho_items(
          id, estado, notas,
          ventas(id, total, clientes(nombre))
        )
      `)
      .eq('vendedor_id', session.user.id)
      .order('fecha', { ascending: false })
      .limit(30);

    setDespachos(
      (data ?? []).map((d) => ({
        id: d.id,
        fecha: d.fecha,
        estado: d.estado as Despacho['estado'],
        items: (d.despacho_items ?? []).map((item: Record<string, unknown>) => {
          const venta = item.ventas as Record<string, unknown> | null;
          const cliente = venta?.clientes as Record<string, unknown> | null;
          return {
            id: item.id as string,
            estado: item.estado as DespachoItem['estado'],
            notas: item.notas as string | null,
            venta: venta
              ? { id: venta.id as string, total: Number(venta.total), cliente: (cliente?.nombre as string | null) ?? null }
              : null,
          };
        }),
      })),
    );
  }

  useEffect(() => {
    fetchDespachos().finally(() => setLoading(false));
  }, [session]);

  async function marcarItem(
    despachoId: string,
    itemId: string,
    estado: 'entregado' | 'fallido',
  ) {
    Alert.alert(
      estado === 'entregado' ? 'Marcar como entregado' : 'Marcar como fallido',
      '¿Confirmar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setBusy(itemId);
            const { error } = await supabase.rpc('marcar_despacho_item', {
              p_item_id: itemId,
              p_estado: estado,
            });
            setBusy(null);
            if (error) { Alert.alert('Error', error.message); return; }
            setDespachos((prev) =>
              prev.map((d) =>
                d.id !== despachoId
                  ? d
                  : { ...d, items: d.items.map((i) => i.id === itemId ? { ...i, estado } : i) },
              ),
            );
          },
        },
      ],
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator /></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      data={despachos}
      keyExtractor={(d) => d.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchDespachos();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
          No tienes despachos asignados
        </Text>
      }
      renderItem={({ item: d }) => {
        const entregados = d.items.filter((i) => i.estado === 'entregado').length;
        const total = d.items.reduce((sum, i) => sum + (i.venta?.total ?? 0), 0);
        const colors = ESTADO_COLORS[d.estado] ?? ESTADO_COLORS.pendiente!;
        return (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View>
                <Text style={s.cardFecha}>{d.fecha}</Text>
                <Text style={s.cardSub}>
                  {entregados}/{d.items.length} entregados · S/ {total.toFixed(2)}
                </Text>
              </View>
              <View style={[s.badge, { backgroundColor: colors.bg }]}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
                  {d.estado.replace('_', ' ')}
                </Text>
              </View>
            </View>

            {d.items.map((item) => {
              const itemColors = ESTADO_COLORS[item.estado] ?? ESTADO_COLORS.pendiente!;
              return (
                <View key={item.id} style={s.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>
                      {item.venta?.cliente ?? 'Sin cliente'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>
                      S/ {(item.venta?.total ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  {item.estado === 'pendiente' ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={[s.btn, { backgroundColor: '#16a34a' }]}
                        disabled={busy === item.id}
                        onPress={() => marcarItem(d.id, item.id, 'entregado')}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                          {busy === item.id ? '…' : 'Entregado'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btn, { backgroundColor: '#dc2626' }]}
                        disabled={busy === item.id}
                        onPress={() => marcarItem(d.id, item.id, 'fallido')}
                      >
                        <Text style={{ color: '#fff', fontSize: 12 }}>Fallido</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[s.badge, { backgroundColor: itemColors.bg }]}>
                      <Text style={{ color: itemColors.text, fontSize: 11 }}>
                        {item.estado}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cardFecha: { fontWeight: '700', fontSize: 16 },
  cardSub: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
});
