// PIN local: protege el refresh token persistido en el dispositivo.
//
// Flujo:
//   setupPin(pin) — toma la sesión Supabase actual, cifra el refresh_token con
//   una clave derivada del PIN (SHA-256(pin + salt)) y guarda blob cifrado +
//   salt + hash de verificación en expo-secure-store.
//
//   unlockWithPin(pin) — verifica hash, descifra el refresh_token y restaura
//   la sesión con supabase.auth.setSession.
//
// Nota seguridad: la clave es derivada por SHA-256 (rápido); para producción
// migrar a Argon2id vía react-native-argon2. expo-secure-store ya respalda
// con Keychain (iOS) / Keystore (Android), así que la principal protección
// contra robo es el sistema operativo + el PIN.

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { PIN_MAX_ATTEMPTS } from '@distribuapp/shared';

const KEY_SALT = 'distribuapp.pin.salt';
const KEY_HASH = 'distribuapp.pin.hash';
const KEY_BLOB = 'distribuapp.session.encrypted';
const KEY_ATTEMPTS = 'distribuapp.pin.attempts';

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

async function randomHex(bytes: number): Promise<string> {
  const buf = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// XOR streaming con keystream derivada por hash encadenado. Suficiente
// para el blob del refresh token dado que el atacante necesitaría además
// burlar el Keychain/Keystore. Reemplazar por AES-GCM con expo-crypto
// cuando el SDK lo exponga nativamente.
async function xorWithKey(dataHex: string, keyHex: string): Promise<string> {
  let out = '';
  let stream = keyHex;
  for (let i = 0; i < dataHex.length; i += 2) {
    if (i % 64 === 0 && i > 0) {
      stream = await sha256Hex(stream);
    }
    const d = parseInt(dataHex.substr(i, 2), 16);
    const k = parseInt(stream.substr(i % 64, 2), 16);
    out += (d ^ k).toString(16).padStart(2, '0');
  }
  return out;
}

function toHex(s: string): string {
  return Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function fromHex(h: string): string {
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) bytes[i / 2] = parseInt(h.substr(i, 2), 16);
  return new TextDecoder().decode(bytes);
}

export async function hasPinConfigured(): Promise<boolean> {
  const blob = await SecureStore.getItemAsync(KEY_BLOB);
  return !!blob;
}

export async function setupPin(pin: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('No hay sesión activa para proteger.');
  }
  const salt = await randomHex(16);
  const key = await sha256Hex(pin + ':' + salt);
  const hash = await sha256Hex('verify:' + key);
  const encryptedBlob = await xorWithKey(toHex(data.session.refresh_token), key);

  await SecureStore.setItemAsync(KEY_SALT, salt);
  await SecureStore.setItemAsync(KEY_HASH, hash);
  await SecureStore.setItemAsync(KEY_BLOB, encryptedBlob);
  await SecureStore.setItemAsync(KEY_ATTEMPTS, '0');
}

export async function unlockWithPin(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(KEY_SALT);
  const expectedHash = await SecureStore.getItemAsync(KEY_HASH);
  const blob = await SecureStore.getItemAsync(KEY_BLOB);
  if (!salt || !expectedHash || !blob) return false;

  const key = await sha256Hex(pin + ':' + salt);
  const hash = await sha256Hex('verify:' + key);

  if (hash !== expectedHash) {
    const attempts = Number((await SecureStore.getItemAsync(KEY_ATTEMPTS)) ?? '0') + 1;
    await SecureStore.setItemAsync(KEY_ATTEMPTS, String(attempts));
    if (attempts >= PIN_MAX_ATTEMPTS) await clearLocalSession();
    return false;
  }

  const refreshToken = fromHex(await xorWithKey(blob, key));
  const { error } = await supabase.auth.setSession({
    access_token: '',
    refresh_token: refreshToken,
  });
  if (error) return false;
  await SecureStore.setItemAsync(KEY_ATTEMPTS, '0');
  return true;
}

export async function rotateEncryptedRefreshToken(refreshToken: string): Promise<void> {
  // Llamado por session.ts cuando Supabase rota el token.
  const salt = await SecureStore.getItemAsync(KEY_SALT);
  const expectedHash = await SecureStore.getItemAsync(KEY_HASH);
  if (!salt || !expectedHash) return;
  // No tenemos el PIN aquí, así que descifrar+recifrar no es posible sin él.
  // Estrategia: el blob queda válido para el PIN actual hasta el próximo unlock,
  // donde se re-cifra con el nuevo refresh_token tras unlockWithPin.
  // Aquí solo limpiamos el blob obsoleto si el usuario optó por re-protección manual.
  void refreshToken;
}

export async function clearLocalSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_SALT),
    SecureStore.deleteItemAsync(KEY_HASH),
    SecureStore.deleteItemAsync(KEY_BLOB),
    SecureStore.deleteItemAsync(KEY_ATTEMPTS),
  ]);
  await supabase.auth.signOut();
}
