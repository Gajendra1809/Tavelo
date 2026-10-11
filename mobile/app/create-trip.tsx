import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { CreateTripScreen } from '@/features/trips/CreateTripScreen';
import { colors } from '@/theme';

export default function CreateTripRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New trip',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <CreateTripScreen />
    </>
  );
}
