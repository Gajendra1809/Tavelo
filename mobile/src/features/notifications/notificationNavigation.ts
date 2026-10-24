import { router, type Href } from 'expo-router';
import { ApiError } from '@/lib/apiClient';
import { getTripBooking } from '@/services/bookingService';
import type { AppNotification } from '@/types/notification';

export async function navigateFromNotification(item: AppNotification): Promise<void> {
  if (item.type === 'trip_invitation') {
    router.push('/invitations' as Href);
    return;
  }

  const tripId = item.trip?.id;
  if (!tripId) {
    return;
  }

  if (item.entityType === 'booking' && item.entityId) {
    try {
      await getTripBooking(tripId, item.entityId);
      router.push(`/trip/${tripId}/bookings/${item.entityId}` as Href);
      return;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.push(`/trip/${tripId}/bookings` as Href);
        return;
      }
      router.push(`/trip/${tripId}/bookings` as Href);
      return;
    }
  }

  if (
    item.entityType === 'expense' ||
    item.entityType === 'settlement' ||
    item.type.startsWith('expense_') ||
    item.type.startsWith('settlement_')
  ) {
    router.push(`/trip/${tripId}/expenses` as Href);
    return;
  }

  if (
    item.entityType === 'message' ||
    item.entityType === 'poll' ||
    item.type === 'chat_message' ||
    item.type.startsWith('poll_')
  ) {
    router.push(`/trip/${tripId}?tab=chat` as Href);
    return;
  }

  router.push(`/trip/${tripId}` as Href);
}
