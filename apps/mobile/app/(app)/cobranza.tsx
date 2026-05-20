import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { getCompanyId, useSession } from '@/lib/auth/session';

type Credito = {
  id: string;
  monto_original: number;
  saldo_pendiente: number;
  fecha_vencimiento: string | null;
  estado: 'vigente' | 'pagado' | 'vencido';
  clientes: { nombre: string; telefono: string | null } | null;
};

const ESTADO_COLOR: Record<string, string> = {
  vigente: '#ca8a04',
  vencido: '#dc2626',
  pagado:  '#16a34a',
};

export default function CobranzaScreen() {
  const { session } = useSession();
  const companyId = getCompanyId(session);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [pagando, setPagando] = useState<string | null>(null);
  const [montoPago, setMontoPago] = useState('');

  async function fetchCreditos() {
    const { data } = await supabase
      .from('creditos')
      .select('id, monto_original, saldo_pendiente, fecha_vencimiento, estado, clientes(nombre, telefono)')
      .neq('estado', 'pagado')
      .order('fecha_vencimiento', { ascending: true });
    setCreditos((data ?? []) as Credito[]);
  }

  useEffect(() => {
    fetchCreditos().finally(() => setLoading(false));
  }, [companyId]);

  async function handleRegistrarPago(credito: Credito) {
    const monto = parseFloat(montoPago);
    if (isNaN(monto) || monto <= 0) { Alert.alert('Monto inválido'); return; }
    if (monto > credito.saldo_pendiente) {
      Alert.alert('El pago supera el saldo pendiente');
      return;
    }
    const { error } = await supabase.from('pagos_credito').insert({
      credito_id: credito.id,
      company_id: companyId!,
      monto,
      fecha: new Date().toISOString().slice(0, 10),
      metodo_pago: 'efectivo',
      usuario_id: session!.user.id,
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setPagando(null);
    setMontoPago('');
    await fetchCreditos();
  }

  const filtered = creditos.filter(
    (c) =>
      !query || (c.clientes?.nombre ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  const totalPendiente = creditos.reduce((s, c) => s + Number(c.saldo_pendiente), 0);

  if (loading) return <View style={s.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={s.header}>
        <Text style={s.title}>Cobranza</Text>
        <Text style={s.subtitle}>Pendiente: S/ {totalPendiente.toFixed(2)}</Text>
      </View>
      <TextInput
        style={s.search}
        placeholder="Buscar cliente…"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchCreditos();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item: c }) => {
          const diasRestantes = c.fecha_vencimiento
            ? Math.ceil(
                (new Date(c.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              )
            : null;
          const estaExpandido = pagando === c.id;

          return (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.clienteNombre}>{c.clientes?.nombre ?? '—'}</Text>
                  {c.clientes?.telefono && (
                    <Text style={s.tel}>{c.clientes.telefono}</Text>
                  )}
                  {c.fecha_vencimiento && (
                    <Text style={{ fontSize: 12, color: diasRestantes !== null && diasRestantes <= 0 ? '#dc2626' : '#666' }}>
                      Vence: {c.fecha_vencimiento}
                      {diasRestantes !== null && ` (${diasRestantes > 0 ? `${diasRestantes}d` : 'vencido'})`}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>
                    S/ {Number(c.saldo_pendiente).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#999' }}>
                    de S/ {Number(c.monto_original).toFixed(2)}
                  </Text>
                  <View style={[s.badge, { backgroundColor: ESTADO_COLOR[c.estado] }]}>
                    <Text style={{ color: '#fff', fontSize: 11 }}>{c.estado}</Text>
                  </View>
                </View>
              </View>

              {estaExpandido ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                    Monto a cobrar (máx S/ {Number(c.saldo_pendiente).toFixed(2)})
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      keyboardType="decimal-pad"
                      value={montoPago}
                      onChangeText={setMontoPago}
                      placeholder={Number(c.saldo_pendiente).toFixed(2)}
                    />
                    <TouchableOpacity style={s.btnSmall} onPress={() => handleRegistrarPago(c)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Cobrar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.btnSmall, { backgroundColor: '#6b7280' }]}
                      onPress={() => { setPagando(null); setMontoPago(''); }}
                    >
                      <Text style={{ color: '#fff' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.btnCobrar}
                  onPress={() => { setPagando(c.id); setMontoPago(''); }}
                >
                  <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 13 }}>
                    Registrar pago
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
            Sin créditos pendientes
          </Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', marginTop: 2 },
  search: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  clienteNombre: { fontWeight: '600', fontSize: 15, marginBottom: 2 },
  tel: { fontSize: 12, color: '#666', marginBottom: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, backgroundColor: '#f8fafc' },
  btnSmall: { backgroundColor: '#2563eb', paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnCobrar: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10, alignItems: 'center' },
});
