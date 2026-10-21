import { useCallback, useEffect, useRef, useState } from 'react';
import { isWeatherEligiblePlace } from '@/features/weather/weatherEligibility';
import { ApiError } from '@/lib/apiClient';
import { fetchTripWeather } from '@/services/weatherService';
import type { TaveloPlace } from '@/types/place';
import type { TripWeatherData, TripWeatherResponse } from '@/types/weather';

type ActiveWeatherState =
  | { status: 'loading' }
  | { status: 'refreshing'; data: TripWeatherData }
  | { status: 'ready'; data: TripWeatherData }
  | { status: 'unavailable'; response: Extract<TripWeatherResponse, { available: false }> }
  | { status: 'error'; message: string; retryable: boolean };

export type WeatherState = ActiveWeatherState | { status: 'idle' };

export function useTripWeather(tripId: string, place: TaveloPlace | null) {
  const eligible = isWeatherEligiblePlace(place);
  const [activeState, setActiveState] = useState<ActiveWeatherState>({ status: 'loading' });
  const inFlight = useRef(false);
  const coordKey =
    place?.latitude != null && place?.longitude != null
      ? `${place.latitude}:${place.longitude}`
      : 'none';

  const load = useCallback(
    async (refresh: boolean) => {
      if (!tripId || !eligible || inFlight.current) {
        return;
      }
      inFlight.current = true;
      setActiveState((current) => {
        if (refresh && current.status === 'ready') {
          return { status: 'refreshing', data: current.data };
        }
        return { status: 'loading' };
      });
      try {
        const response = await fetchTripWeather(tripId, refresh);
        if (!response.available) {
          setActiveState({ status: 'unavailable', response });
        } else {
          setActiveState({ status: 'ready', data: response });
        }
      } catch (error) {
        setActiveState({
          status: 'error',
          message:
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Weather is unavailable.',
          retryable: true,
        });
      } finally {
        inFlight.current = false;
      }
    },
    [eligible, tripId],
  );

  useEffect(() => {
    if (!tripId || !eligible) {
      return;
    }
    const handle = setTimeout(() => {
      void load(false);
    }, 0);
    return () => clearTimeout(handle);
  }, [eligible, tripId, coordKey, load]);

  const state: WeatherState =
    !tripId || !eligible ? { status: 'idle' } : activeState;

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return {
    eligible,
    state,
    refresh,
    retry: () => void load(false),
  };
}
