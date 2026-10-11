import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
  const [state, setState] = useState<TripListState>({
    trips: [],
    loading: true,
    refreshing: false,
    error: null,
  });

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    setState((current) => ({
      ...current,
      loading: mode === 'initial' && current.trips.length === 0,
      refreshing: mode === 'refresh',
      error: null,
    }));

    try {
      const result = await listTrips();
      setState({
        trips: result.trips,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Could not load trips. Try again.';
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: message,
      }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  return { ...state, refresh };
}
