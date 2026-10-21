import { apiRequest } from '@/lib/apiClient';
import type { TripWeatherResponse } from '@/types/weather';

export async function fetchTripWeather(
  tripId: string,
  refresh = false,
): Promise<TripWeatherResponse> {
  const query = refresh ? '?refresh=true' : '';
  return apiRequest<TripWeatherResponse>(`/api/v1/trips/${tripId}/weather${query}`, {
    timeoutMs: 20_000,
  });
}
