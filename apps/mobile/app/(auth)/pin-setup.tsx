import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { pinSetupSchema, PIN_LENGTH } from '@distribuapp/shared';
import { setupPin } from '@/lib/auth/pin';

export default function PinSetupScreen() {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    const parsed = pinSetupSchema.safeParse({ pin, confirm });
    if (!parsed.success) {
      Alert.alert('PIN inválido', parsed.error.issues[0]?.message ?? '');
      return;
    }
    setBusy(true);
    try {
      await setupPin(pin);
      router.replace('/(app)/inventario');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configura tu PIN</Text>
      <Text style={styles.subtitle}>
        Lo usarás para abrir la app rápido. {PIN_LENGTH} dígitos.
      </Text>

      <Text style={styles.label}>PIN</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        value={pin}
        onChangeText={setPin}
      />

      <Text style={styles.label}>Confirmar PIN</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        value={confirm}
        onChangeText={setConfirm}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Guardando…' : 'Guardar PIN'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 24, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
