import { Stack, useLocalSearchParams } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { BookingFormScreen } from '@/features/bookings/BookingFormScreen';
import { colors } from '@/theme';

export default function CreateBookingRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Add booking',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <BookingFormScreen tripId={tripId} />
    </>
  );
}
