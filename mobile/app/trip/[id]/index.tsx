import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { TripDetailScreen } from '@/features/trips/TripDetailScreen';
import { colors } from '@/theme';

export default function TripDetailRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Trip',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <TripDetailScreen />
    </>
  );
}
