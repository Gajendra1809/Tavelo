import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') {
    return <BootScreen />;
  }

  const signedIn = status === 'authenticated';

  return (
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
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
