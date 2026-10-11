import { useCallback, useEffect, useState } from 'react';
import { tripCache, TRIP_DETAIL_TTL_MS, useCachedTrip } from '@/lib/cache/tripCache';
import { ApiError } from '@/lib/apiClient';
import { getTrip } from '@/services/tripService';
import type { Trip } from '@/types/trip';

type UseTripFromCacheResult = {
  trip: Trip | null;
  loading: boolean;
  error: string | null;
  errorStatus: number | undefined;
  refresh: (options?: { force?: boolean }) => Promise<void>;
};

export function useTripFromCache(tripId: string | undefined): UseTripFromCacheResult {
  const cached = useCachedTrip(tripId);
  const [trip, setTrip] = useState<Trip | null>(() => (tripId ? tripCache.getTrip(tripId) : null));
  const [loading, setLoading] = useState(() => Boolean(tripId && !tripCache.getTrip(tripId)));
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      setLoading(false);
      return;
    }
    const next = tripCache.getTrip(tripId);
    if (next) {
      setTrip(next);
      setLoading(false);
    }
  }, [tripId, cached]);

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      if (!tripId) {
        setError('This trip link is missing an id.');
        setLoading(false);
        return;
      }
      const force = options?.force ?? false;
      const hasCached = Boolean(tripCache.getTrip(tripId));
      if (!force && tripCache.isTripFresh(tripId)) {
        if (hasCached) {
          setTrip(tripCache.getTrip(tripId));
        }
        return;
      }
      if (!hasCached) {
        setLoading(true);
      }
      setError(null);
      setErrorStatus(undefined);
      try {
        const loaded = await getTrip(tripId);
        tripCache.setTrip(loaded);
        setTrip(loaded);
      } catch (loadError) {
        if (!hasCached) {
          setTrip(null);
        }
        if (loadError instanceof ApiError) {
          setError(loadError.message);
          setErrorStatus(loadError.status);
        } else {
          setError('Could not load this trip. Try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [tripId],
  );

  return { trip, loading, error, errorStatus, refresh };
}

export { TRIP_DETAIL_TTL_MS };
