import type { MemoryFilter, TripMemoryItem } from '@/types/memory';
import { createKeyedTTLStore } from '@/lib/cache/createTTLStore';

export const MEMORY_LIST_TTL_MS = 5 * 60_000;

export type MemoryListSnapshot = {
  items: TripMemoryItem[];
  nextCursor: string | null;
  total: number;
  photoCount: number;
  videoCount: number;
};

const byTripId = createKeyedTTLStore<MemoryListSnapshot>();

export function filterMemoryItems(items: TripMemoryItem[], filter: MemoryFilter): TripMemoryItem[] {
  if (filter === 'all') {
    return items;
  }
  return items.filter((item) => item.mediaType === filter);
}

export const memoryCache = {
  get(tripId: string): MemoryListSnapshot | null {
    return byTripId.get(tripId);
  },
  set(tripId: string, snapshot: MemoryListSnapshot): void {
    byTripId.set(tripId, snapshot);
  },
  isFresh(tripId: string): boolean {
    return byTripId.isFresh(tripId, MEMORY_LIST_TTL_MS);
  },
  invalidate(tripId: string): void {
    byTripId.invalidate(tripId);
  },
  patchItem(tripId: string, item: TripMemoryItem): void {
    const current = byTripId.get(tripId);
    if (!current) {
      return;
    }
    byTripId.set(tripId, {
      ...current,
      items: current.items.map((row) => (row.id === item.id ? item : row)),
    });
  },
  prependItem(tripId: string, item: TripMemoryItem): void {
    const current = byTripId.get(tripId);
    if (!current) {
      return;
    }
    byTripId.set(tripId, {
      ...current,
      items: [item, ...current.items],
      total: current.total + 1,
      photoCount: current.photoCount + (item.mediaType === 'image' ? 1 : 0),
      videoCount: current.videoCount + (item.mediaType === 'video' ? 1 : 0),
    });
  },
  removeItem(tripId: string, mediaId: string, mediaType: 'image' | 'video'): void {
    const current = byTripId.get(tripId);
    if (!current) {
      return;
    }
    byTripId.set(tripId, {
      ...current,
      items: current.items.filter((row) => row.id !== mediaId),
      total: Math.max(0, current.total - 1),
      photoCount: Math.max(0, current.photoCount - (mediaType === 'image' ? 1 : 0)),
      videoCount: Math.max(0, current.videoCount - (mediaType === 'video' ? 1 : 0)),
    });
  },
};
