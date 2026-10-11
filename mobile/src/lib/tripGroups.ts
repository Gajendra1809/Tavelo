import { todayDateInput } from '@/lib/dates';
import type { Trip } from '@/types/trip';

export function isUpcomingTrip(trip: Trip, today = todayDateInput()): boolean {
  return trip.endDate >= today;
}

export function splitTrips(trips: Trip[], today = todayDateInput()) {
  const upcoming = trips
    .filter((trip) => isUpcomingTrip(trip, today))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  const past = trips
    .filter((trip) => !isUpcomingTrip(trip, today))
    .sort((left, right) => right.endDate.localeCompare(left.endDate));

  return { upcoming, past };
}
