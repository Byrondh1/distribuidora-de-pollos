import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { PIN_LENGTH } from '@distribuapp/shared';
import { clearLocalSession, unlockWithPin } from '@/lib/auth/pin';

export default function PinUnlockScreen() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleUnlock(value: string) {
    setBusy(true);
    const ok = await unlockWithPin(value);
    setBusy(false);
    if (ok) {
      router.replace('/(app)/inventario');
    } else {
      setPin('');
      Alert.alert('PIN incorrecto', 'Intenta de nuevo.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Desbloquear</Text>
      <Text style={styles.subtitle}>Ingresa tu PIN de {PIN_LENGTH} dígitos</Text>

      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        value={pin}
        onChangeText={(v) => {
          setPin(v);
          if (v.length === PIN_LENGTH) handleUnlock(v);
        }}
        autoFocus
        editable={!busy}
      />

      <TouchableOpacity
        onPress={async () => {
          await clearLocalSession();
          router.replace('/(auth)/login');
        }}
      >
        <Text style={styles.link}>Olvidé mi PIN — entrar con contraseña</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 32, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 12,
  },
  link: { textAlign: 'center', color: '#2563eb', marginTop: 24 },
});
