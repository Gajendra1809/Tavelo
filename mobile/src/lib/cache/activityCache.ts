import { createKeyedTTLStore } from '@/lib/cache/createTTLStore';
import type { ItineraryActivity } from '@/types/itinerary';

export const ACTIVITY_DAY_TTL_MS = 60_000;

const byDayKey = createKeyedTTLStore<ItineraryActivity[]>();

function dayKey(tripId: string, day: string): string {
  return `${tripId}:${day}`;
}

export const activityCache = {
  get(tripId: string, day: string): ItineraryActivity[] | null {
    return byDayKey.get(dayKey(tripId, day));
  },
  set(tripId: string, day: string, activities: ItineraryActivity[]): void {
    byDayKey.set(dayKey(tripId, day), activities);
  },
  isFresh(tripId: string, day: string): boolean {
    return byDayKey.isFresh(dayKey(tripId, day), ACTIVITY_DAY_TTL_MS);
  },
  invalidateDay(tripId: string, day: string): void {
    byDayKey.invalidate(dayKey(tripId, day));
  },
};
