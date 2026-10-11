import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { CreateTripInput, Trip, UpdateTripInput } from '@/types/trip';

export function listTrips(): Promise<{ trips: Trip[] }> {
  return apiRequest<{ trips: Trip[] }>(TRIPS_PATH);
}

export function getTrip(id: string): Promise<Trip> {
  return apiRequest<Trip>(`${TRIPS_PATH}/${encodeURIComponent(id)}`);
}

export function createTrip(input: CreateTripInput): Promise<Trip> {
  return apiRequest<Trip>(TRIPS_PATH, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
  return apiRequest<Trip>(`${TRIPS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTrip(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`${TRIPS_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
