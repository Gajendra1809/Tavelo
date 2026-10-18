import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import { normalizeActivity } from '@/lib/normalizePlaceFields';
import type { ItineraryActivity } from '@/types/itinerary';
import type { TaveloPlace } from '@/types/place';

export async function listActivities(
  tripId: string,
  date?: string,
): Promise<{ activities: ItineraryActivity[] }> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const result = await apiRequest<{ activities: ItineraryActivity[] }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities${query}`,
  );
  return { activities: result.activities.map(normalizeActivity) };
}

export async function createActivity(
  tripId: string,
  body: {
    title: string;
    location?: string | null;
    place?: TaveloPlace | null;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string;
  },
): Promise<ItineraryActivity> {
  const activity = await apiRequest<ItineraryActivity>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return normalizeActivity(activity);
}

export async function updateActivity(
  tripId: string,
  activityId: string,
  body: {
    title?: string;
    location?: string | null;
    place?: TaveloPlace | null;
    date?: string;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string;
  },
): Promise<ItineraryActivity> {
  const activity = await apiRequest<ItineraryActivity>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  return normalizeActivity(activity);
}

export function deleteActivity(tripId: string, activityId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `${TRIPS_PATH}/${encodeURIComponent(tripId)}/activities/${encodeURIComponent(activityId)}`,
    { method: 'DELETE' },
  );
}
