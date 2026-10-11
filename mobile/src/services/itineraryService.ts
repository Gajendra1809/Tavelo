import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { ItineraryActivity } from '@/types/itinerary';

export function listActivities(
  tripId: string,
  date?: string,
): Promise<{ activities: ItineraryActivity[] }> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<{ activities: ItineraryActivity[] }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities${query}`,
  );
}

export function createActivity(
  tripId: string,
  body: {
    title: string;
    location?: string | null;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string;
  },
): Promise<ItineraryActivity> {
  return apiRequest<ItineraryActivity>(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateActivity(
  tripId: string,
  activityId: string,
  body: {
    title?: string;
    location?: string | null;
    date?: string;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string;
  },
): Promise<ItineraryActivity> {
  return apiRequest<ItineraryActivity>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export function deleteActivity(tripId: string, activityId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
    { method: 'DELETE' },
  );
}
