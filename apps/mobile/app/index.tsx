import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '@/lib/auth/session';
import { hasPinConfigured } from '@/lib/auth/pin';

export default function Splash() {
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    (async () => {
      const pinSet = await hasPinConfigured();
      if (session) {
        router.replace('/(app)/inventario');
      } else if (pinSet) {
        router.replace('/(auth)/pin-unlock');
      } else {
        router.replace('/(auth)/login');
      }
    })();
  }, [session, loading]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
