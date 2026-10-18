import { apiRequest } from '@/lib/apiClient';
import type { PlaceSearchHit } from '@/types/place';

const PLACES_SEARCH_PATH = '/api/v1/places/search';

type PlaceSearchResponse = {
  results: PlaceSearchHit[];
  attribution: string;
};

export async function searchPlaces(query: string): Promise<PlaceSearchResponse> {
  const params = new URLSearchParams({ q: query.trim(), limit: '8' });
  return apiRequest<PlaceSearchResponse>(`${PLACES_SEARCH_PATH}?${params.toString()}`, {
    timeoutMs: 20_000,
  });
}
