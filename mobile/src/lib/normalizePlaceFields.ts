import type { ItineraryActivity } from '@/types/itinerary';
import type { TripBooking } from '@/types/booking';
import type { Trip } from '@/types/trip';

/** Older API responses may omit structured place fields. */
export function normalizeTrip(trip: Trip): Trip {
  return {
    ...trip,
    destinationPlace: trip.destinationPlace ?? null,
  };
}

export function normalizeActivity(activity: ItineraryActivity): ItineraryActivity {
  return {
    ...activity,
    place: activity.place ?? null,
  };
}

export function normalizeBooking(booking: TripBooking): TripBooking {
  return {
    ...booking,
    place: booking.place ?? null,
  };
}
