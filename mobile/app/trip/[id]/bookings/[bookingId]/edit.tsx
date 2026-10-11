import { Stack, useLocalSearchParams } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { BookingFormScreen } from '@/features/bookings/BookingFormScreen';
import { colors } from '@/theme';

export default function EditBookingRoute() {
  const params = useLocalSearchParams<{ id: string; bookingId: string }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit booking',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <BookingFormScreen tripId={tripId} bookingId={bookingId} />
    </>
  );
}
