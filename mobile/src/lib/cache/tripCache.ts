import { useSyncExternalStore } from 'react';
import { createKeyedTTLStore, createTTLStore } from '@/lib/cache/createTTLStore';
import type { Trip } from '@/types/trip';

/** Single-trip detail cache TTL (show stale, refresh in background). */
export const TRIP_DETAIL_TTL_MS = 60_000;

/** Trip list cache TTL. */
export const TRIP_LIST_TTL_MS = 60_000;

const tripById = createKeyedTTLStore<Trip>();
const tripList = createTTLStore<Trip[]>(null);

export const tripCache = {
  getTrip(id: string): Trip | null {
    return tripById.get(id);
  },
  setTrip(trip: Trip): void {
    tripById.set(trip.id, trip);
  },
  isTripFresh(id: string): boolean {
    return tripById.isFresh(id, TRIP_DETAIL_TTL_MS);
  },
  invalidateTrip(id: string): void {
    tripById.invalidate(id);
  },
  getList(): Trip[] | null {
    return tripList.get();
  },
  setList(trips: Trip[]): void {
    tripList.set(trips);
    for (const trip of trips) {
      if (!tripById.isFresh(trip.id, TRIP_DETAIL_TTL_MS)) {
        tripById.set(trip.id, trip);
      }
    }
  },
  isListFresh(): boolean {
    return tripList.isFresh(TRIP_LIST_TTL_MS);
  },
  invalidateList(): void {
    tripList.invalidate();
  },
  invalidateAll(): void {
    tripList.invalidate();
    tripById.invalidateAll();
  },
  subscribe(listener: () => void): () => void {
    const offList = tripList.subscribe(listener);
    const offTrips = tripById.subscribe(listener);
    return () => {
      offList();
      offTrips();
    };
  },
};

export function useCachedTrip(tripId: string | undefined): Trip | null {
  return useSyncExternalStore(
    tripCache.subscribe,
    () => (tripId ? tripCache.getTrip(tripId) : null),
    () => null,
  );
}

export function useCachedTripList(): Trip[] | null {
  return useSyncExternalStore(tripCache.subscribe, () => tripCache.getList(), () => null);
}
