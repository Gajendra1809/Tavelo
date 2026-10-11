import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { NotificationUnreadSync } from '@/components/NotificationUnreadSync';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') {
    return <BootScreen />;
  }

  const signedIn = status === 'authenticated';

  return (
    <>
      {signedIn ? <NotificationUnreadSync /> : null}
      <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.sky },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-trip" />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="invitations" />
        <Stack.Screen name="notifications" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
    </>
  );
}
