import { Stack, useLocalSearchParams } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { BookingDetailScreen } from '@/features/bookings/BookingDetailScreen';
import { colors } from '@/theme';

export default function BookingDetailRoute() {
  const params = useLocalSearchParams<{ id: string; bookingId: string }>();
  const tripId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Booking',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <BookingDetailScreen tripId={tripId} bookingId={bookingId} />
    </>
  );
}
