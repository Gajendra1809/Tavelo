import { Stack, useLocalSearchParams } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { TripBookingsScreen } from '@/features/bookings/TripBookingsScreen';
import { colors } from '@/theme';

export default function TripBookingsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Bookings',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <TripBookingsScreen tripId={id} />
    </>
  );
}
