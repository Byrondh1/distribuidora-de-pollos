import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="inventario" options={{ title: 'Inventario' }} />
      <Stack.Screen name="nueva-venta" options={{ title: 'Nueva venta', presentation: 'modal' }} />
      <Stack.Screen name="caja" options={{ title: 'Mi caja' }} />
      <Stack.Screen name="cobranza" options={{ title: 'Cobranza' }} />
      <Stack.Screen name="despacho" options={{ title: 'Mis despachos' }} />
    </Stack>
  );
}
