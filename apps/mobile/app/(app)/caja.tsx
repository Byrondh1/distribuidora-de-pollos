import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth/session';

type CajaResumen = {
  caja_id: string;
  fecha: string;
  monto_apertura: number;
  monto_cierre: number | null;
  estado: 'abierta' | 'cerrada';
  total_efectivo: number;
  total_transferencia: number;
  total_credito: number;
  total_ventas: number;
  num_ventas: number;
};

export default function CajaScreen() {
  const { session } = useSession();
  const [resumen, setResumen] = useState<CajaResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [montoApertura, setMontoApertura] = useState('0');
  const [montoCierre, setMontoCierre] = useState('');
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(false);

  async function cargarResumen() {
    if (!session) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('caja_resumen')
      .select('*')
      .eq('vendedor_id', session.user.id)
      .eq('fecha', hoy)
      .maybeSingle();
    setResumen(data ?? null);
  }

  useEffect(() => {
    cargarResumen().finally(() => setLoading(false));
  }, [session]);

  async function handleAbrirCaja() {
    setBusy(true);
    const { error } = await supabase.rpc('abrir_caja', {
      p_monto_apertura: parseFloat(montoApertura) || 0,
    });
    setBusy(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await cargarResumen();
  }

  async function handleCerrarCaja() {
    const cierre = parseFloat(montoCierre);
    if (isNaN(cierre) || cierre < 0) { Alert.alert('Ingresa un monto de cierre válido'); return; }
    Alert.alert(
      'Cerrar caja',
      `Monto de cierre: S/ ${cierre.toFixed(2)}. ¿Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc('cerrar_caja', {
              p_monto_cierre: cierre,
              p_notas: notas || null,
            });
            setBusy(false);
            if (error) { Alert.alert('Error', error.message); return; }
            await cargarResumen();
          },
        },
      ],
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator /></View>;
  }

  const esperado = resumen
    ? Number(resumen.monto_apertura) + Number(resumen.total_efectivo)
    : 0;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>Caja del día</Text>
      <Text style={s.fecha}>{new Date().toLocaleDateString('es-PE', { dateStyle: 'full' })}</Text>

      {!resumen ? (
        /* ── Sin caja abierta ── */
        <View style={s.card}>
          <Text style={s.cardTitle}>Abrir caja</Text>
          <Text style={s.label}>Monto inicial en efectivo (S/)</Text>
          <TextInput
            style={s.input}
            keyboardType="decimal-pad"
            value={montoApertura}
            onChangeText={setMontoApertura}
          />
          <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={handleAbrirCaja} disabled={busy}>
            <Text style={s.btnText}>{busy ? 'Abriendo…' : 'Abrir caja'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Resumen de ventas ── */}
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.label}>Estado</Text>
              <View style={[s.badge, resumen.estado === 'abierta' ? s.badgeGreen : s.badgeGray]}>
                <Text style={{ color: '#fff', fontSize: 12 }}>{resumen.estado}</Text>
              </View>
            </View>
            <Linea label="Ventas del día" valor={resumen.num_ventas.toString()} unidad="ventas" />
            <Linea label="Efectivo" valor={`S/ ${Number(resumen.total_efectivo).toFixed(2)}`} />
            <Linea label="Transferencia" valor={`S/ ${Number(resumen.total_transferencia).toFixed(2)}`} />
            <Linea label="Crédito" valor={`S/ ${Number(resumen.total_credito).toFixed(2)}`} />
            <View style={s.divider} />
            <Linea label="Total ventas" valor={`S/ ${Number(resumen.total_ventas).toFixed(2)}`} bold />
            <Linea label="Apertura" valor={`S/ ${Number(resumen.monto_apertura).toFixed(2)}`} />
            <Linea label="Esperado en caja" valor={`S/ ${esperado.toFixed(2)}`} bold />
          </View>

          {/* ── Cierre ── */}
          {resumen.estado === 'abierta' ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Cerrar caja</Text>
              <Text style={s.label}>Monto contado (S/)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                value={montoCierre}
                onChangeText={setMontoCierre}
                placeholder={esperado.toFixed(2)}
              />
              {montoCierre ? (
                <Text style={{ marginBottom: 8, color: parseFloat(montoCierre) >= esperado ? '#16a34a' : '#dc2626' }}>
                  Diferencia: S/ {(parseFloat(montoCierre) - esperado).toFixed(2)}
                </Text>
              ) : null}
              <Text style={s.label}>Notas (opcional)</Text>
              <TextInput
                style={[s.input, { height: 60 }]}
                multiline
                value={notas}
                onChangeText={setNotas}
                placeholder="Observaciones del cierre…"
              />
              <TouchableOpacity
                style={[s.btn, s.btnRed, busy && { opacity: 0.6 }]}
                onPress={handleCerrarCaja}
                disabled={busy}
              >
                <Text style={s.btnText}>{busy ? 'Cerrando…' : 'Cerrar caja'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.card}>
              <Linea label="Cierre declarado" valor={`S/ ${Number(resumen.monto_cierre).toFixed(2)}`} bold />
              <Linea
                label="Diferencia"
                valor={`S/ ${(Number(resumen.monto_cierre) - esperado).toFixed(2)}`}
                color={Number(resumen.monto_cierre) >= esperado ? '#16a34a' : '#dc2626'}
              />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Linea({
  label,
  valor,
  unidad,
  bold,
  color,
}: {
  label: string;
  valor: string;
  unidad?: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ color: '#666' }}>{label}</Text>
      <Text style={{ fontWeight: bold ? '700' : '400', color: color ?? '#111' }}>
        {valor}{unidad ? ` ${unidad}` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  fecha: { color: '#666', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  label: { fontSize: 13, color: '#666', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12 },
  btn: { backgroundColor: '#2563eb', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  btnRed: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeGreen: { backgroundColor: '#16a34a' },
  badgeGray: { backgroundColor: '#6b7280' },
  divider: { borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 8 },
});
