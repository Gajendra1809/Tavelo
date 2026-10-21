import { AppError } from '../../utils/AppError';
import { searchPlacesNominatim } from './nominatim.service';
import { searchPlacesPhoton } from './photon.service';
import type { PlaceSearchResult } from './place.schema';

export async function searchPlacesForApi(query: string, limit: number): Promise<PlaceSearchResult[]> {
  try {
    const nominatimResults = await searchPlacesNominatim(query, limit);
    if (nominatimResults.length > 0) {
      return nominatimResults;
    }
  } catch {
    // Nominatim often fails from shared cloud IPs; fall through to Photon.
  }

  try {
    return await searchPlacesPhoton(query, limit);
  } catch {
    throw new AppError(502, 'UPSTREAM_ERROR', 'Place search is temporarily unavailable.');
  }
}
