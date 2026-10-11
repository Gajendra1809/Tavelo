import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { tripCache } from '@/lib/cache/tripCache';
import { ApiError } from '@/lib/apiClient';
import { listTrips } from '@/services/tripService';
import type { Trip } from '@/types/trip';

type TripListState = {
  trips: Trip[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

export function useTrips() {
  const [state, setState] = useState<TripListState>(() => {
    const cached = tripCache.getList();
    return {
      trips: cached ?? [],
      loading: !cached?.length,
      refreshing: false,
      error: null,
    };
  });

  const fetchList = useCallback(async () => {
    const result = await listTrips();
    tripCache.setList(result.trips);
    setState({
      trips: result.trips,
      loading: false,
      refreshing: false,
      error: null,
    });
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'background') => {
    const cached = tripCache.getList();
    if (mode === 'background') {
      try {
        await fetchList();
      } catch {
        // Keep showing the cached list.
      }
      return;
    }

    if (mode === 'initial' && tripCache.isListFresh() && cached) {
      setState((current) => ({
        ...current,
        trips: cached,
        loading: false,
        refreshing: false,
        error: null,
      }));
      void fetchList().catch(() => undefined);
      return;
    }

    setState((current) => ({
      ...current,
      loading: mode === 'initial' && current.trips.length === 0 && !cached?.length,
      refreshing: mode === 'refresh',
      error: null,
    }));

    try {
      await fetchList();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Could not load trips. Try again.';
      setState((current) => ({
        ...current,
        trips: cached ?? current.trips,
        loading: false,
        refreshing: false,
        error: message,
      }));
    }
  }, [fetchList]);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const refresh = useCallback(() => {
    tripCache.invalidateList();
    return load('refresh');
  }, [load]);

  return { ...state, refresh };
}

export function seedTripForNavigation(trip: Trip): void {
  tripCache.setTrip(trip);
}
