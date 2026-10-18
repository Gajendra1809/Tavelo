import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import { normalizeTrip } from '@/lib/normalizePlaceFields';
import type { CreateTripInput, Trip, UpdateTripInput } from '@/types/trip';

export async function listTrips(): Promise<{ trips: Trip[] }> {
  const result = await apiRequest<{ trips: Trip[] }>(TRIPS_PATH);
  return { trips: result.trips.map(normalizeTrip) };
}

export async function getTrip(id: string): Promise<Trip> {
  const trip = await apiRequest<Trip>(`${TRIPS_PATH}/${encodeURIComponent(id)}`);
  return normalizeTrip(trip);
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const trip = await apiRequest<Trip>(TRIPS_PATH, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeTrip(trip);
}

export async function updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
  const trip = await apiRequest<Trip>(`${TRIPS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return normalizeTrip(trip);
}

export function deleteTrip(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`${TRIPS_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
