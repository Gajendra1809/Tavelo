import type { Trip } from '@/types/trip';

/** Match trip list search (name, title, destination). Case-insensitive substring. */
export function tripMatchesSearch(trip: Trip, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const title = (trip.title || trip.name).toLowerCase();
  const destination = trip.destination.toLowerCase();
  const name = trip.name.toLowerCase();
  return title.includes(q) || destination.includes(q) || name.includes(q);
}

export function filterTripsBySearch(trips: Trip[], query: string): Trip[] {
  const q = query.trim();
  if (!q) {
    return trips;
  }
  return trips.filter((trip) => tripMatchesSearch(trip, q));
}
