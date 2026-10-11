import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { InvitationsScreen } from '@/features/invitations/InvitationsScreen';
import { colors } from '@/theme';

export default function InvitationsRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Invitations',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <InvitationsScreen />
    </>
  );
}
