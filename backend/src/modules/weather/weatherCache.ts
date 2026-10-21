import type { TripWeatherPayload } from './weather.types';

export const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
export const WEATHER_MIN_REFRESH_MS = 30 * 1000;

type CacheEntry = {
  payload: TripWeatherPayload;
  providerFetchedAtMs: number;
};

const cacheByCoordinate = new Map<string, CacheEntry>();
const lastManualRefreshByTrip = new Map<string, number>();

export function readWeatherCache(coordinateKey: string): CacheEntry | null {
  return cacheByCoordinate.get(coordinateKey) ?? null;
}

export function writeWeatherCache(coordinateKey: string, payload: TripWeatherPayload): void {
  cacheByCoordinate.set(coordinateKey, {
    payload,
    providerFetchedAtMs: Date.now(),
  });
}

export function isCacheFresh(entry: CacheEntry, nowMs = Date.now()): boolean {
  return nowMs - entry.providerFetchedAtMs < WEATHER_CACHE_TTL_MS;
}

export function canManualRefresh(tripId: string, nowMs = Date.now()): boolean {
  const last = lastManualRefreshByTrip.get(tripId);
  if (last == null) {
    return true;
  }
  return nowMs - last >= WEATHER_MIN_REFRESH_MS;
}

export function markManualRefresh(tripId: string, nowMs = Date.now()): void {
  lastManualRefreshByTrip.set(tripId, nowMs);
}

export function clearWeatherCacheForTests(): void {
  cacheByCoordinate.clear();
  lastManualRefreshByTrip.clear();
}
