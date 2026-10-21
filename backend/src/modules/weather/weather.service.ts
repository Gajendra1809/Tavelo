import { AppError } from '../../utils/AppError';
import { requireTripMember } from '../trips/trip.service';
import { fetchOpenMeteoForecast } from './openMeteo.service';
import {
  canManualRefresh,
  isCacheFresh,
  markManualRefresh,
  readWeatherCache,
  writeWeatherCache,
} from './weatherCache';
import {
  coordinateCacheKey,
  weatherCoordinatesFromPlace,
  weatherUnavailableReason,
} from './weatherEligibility';
import type { TripWeatherResponse } from './weather.types';

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  manual_location:
    'Weather is available only for destinations picked from search with verified coordinates.',
  missing_coordinates:
    'Choose a destination from search so Tavelo can use verified coordinates for weather.',
};

export async function getTripWeather(
  userId: string,
  tripId: string,
  options: { refresh?: boolean } = {},
): Promise<TripWeatherResponse> {
  const trip = await requireTripMember(userId, tripId);
  const place = trip.destinationPlace ?? null;
  const unavailable = weatherUnavailableReason(place);
  if (unavailable === 'manual_location') {
    return {
      available: false,
      reason: 'manual_location',
      message: UNAVAILABLE_MESSAGES.manual_location,
    };
  }
  if (unavailable === 'missing_coordinates') {
    return {
      available: false,
      reason: 'missing_coordinates',
      message: UNAVAILABLE_MESSAGES.missing_coordinates,
    };
  }

  const coords = weatherCoordinatesFromPlace(place);
  if (!coords) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Could not read destination coordinates.');
  }

  const cacheKey = coordinateCacheKey(coords.latitude, coords.longitude);
  const cached = readWeatherCache(cacheKey);
  const wantsRefresh = options.refresh === true;

  if (wantsRefresh && !canManualRefresh(tripId)) {
    if (cached) {
      return withCacheMeta(cached.payload, 'hit', cached.providerFetchedAtMs, false);
    }
  }

  if (cached && isCacheFresh(cached) && !wantsRefresh) {
    return withCacheMeta(cached.payload, 'hit', cached.providerFetchedAtMs, false);
  }

  if (wantsRefresh && canManualRefresh(tripId)) {
    markManualRefresh(tripId);
  }

  try {
    const payload = await fetchOpenMeteoForecast(coords.latitude, coords.longitude);
    writeWeatherCache(cacheKey, payload);
    return withCacheMeta(payload, wantsRefresh ? 'miss' : cached ? 'miss' : 'miss', Date.now(), false);
  } catch {
    if (cached) {
      return withCacheMeta(cached.payload, 'stale', cached.providerFetchedAtMs, true);
    }
    throw new AppError(
      502,
      'UPSTREAM_ERROR',
      'Weather is temporarily unavailable. Try again in a moment.',
    );
  }
}

function withCacheMeta(
  payload: import('./weather.types').TripWeatherPayload,
  cacheStatus: 'hit' | 'miss' | 'stale',
  providerFetchedAtMs: number,
  isStale: boolean,
): import('./weather.types').TripWeatherPayload {
  return {
    ...payload,
    meta: {
      ...payload.meta,
      fetchedAt: new Date(providerFetchedAtMs).toISOString(),
      cacheStatus,
      isStale,
    },
  };
}
