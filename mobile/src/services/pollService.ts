import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { CreatePollBody, TripPoll } from '@/types/poll';

function pollsBase(tripId: string): string {
  return `${TRIPS_PATH}/${encodeURIComponent(tripId)}/polls`;
}

export async function listTripPolls(tripId: string): Promise<{ polls: TripPoll[] }> {
  return apiRequest<{ polls: TripPoll[] }>(pollsBase(tripId));
}

export function getTripPoll(tripId: string, pollId: string): Promise<TripPoll> {
  return apiRequest<TripPoll>(`${pollsBase(tripId)}/${encodeURIComponent(pollId)}`);
}

export function createTripPoll(tripId: string, body: CreatePollBody): Promise<TripPoll> {
  return apiRequest<TripPoll>(pollsBase(tripId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function voteTripPoll(tripId: string, pollId: string, optionIds: string[]): Promise<TripPoll> {
  return apiRequest<TripPoll>(`${pollsBase(tripId)}/${encodeURIComponent(pollId)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionIds }),
  });
}

export function removeTripPollVote(tripId: string, pollId: string): Promise<TripPoll> {
  return apiRequest<TripPoll>(`${pollsBase(tripId)}/${encodeURIComponent(pollId)}/vote`, {
    method: 'DELETE',
  });
}

export function closeTripPoll(tripId: string, pollId: string): Promise<TripPoll> {
  return apiRequest<TripPoll>(`${pollsBase(tripId)}/${encodeURIComponent(pollId)}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function deleteTripPoll(tripId: string, pollId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`${pollsBase(tripId)}/${encodeURIComponent(pollId)}`, {
    method: 'DELETE',
  });
}

export function addTripPollOption(
  tripId: string,
  pollId: string,
  label: string,
): Promise<TripPoll> {
  return apiRequest<TripPoll>(`${pollsBase(tripId)}/${encodeURIComponent(pollId)}/options`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}
