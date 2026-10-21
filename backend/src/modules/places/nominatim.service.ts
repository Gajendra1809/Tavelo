import { AppError } from '../../utils/AppError';
import type { PlaceSearchResult } from './place.schema';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;
const UPSTREAM_TIMEOUT_MS = 12_000;

let lastRequestAt = 0;

type NominatimRow = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  class?: string;
};

function buildUserAgent(): string {
  const fromEnv = process.env.PLACE_SEARCH_USER_AGENT?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return 'Tavelo/1.0 (travel app; contact: support@tavelo.app)';
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

function primaryName(row: NominatimRow): string {
  if (row.name?.trim()) {
    return row.name.trim();
  }
  const display = row.display_name?.trim() ?? '';
  if (!display) {
    return 'Place';
  }
  const first = display.split(',')[0]?.trim();
  return first || display.slice(0, 120);
}

export async function searchPlacesNominatim(
  query: string,
  limit: number,
): Promise<PlaceSearchResult[]> {
  await throttle();

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': buildUserAgent(),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new AppError(502, 'UPSTREAM_ERROR', 'Place search is temporarily unavailable.');
  }

  if (!response.ok) {
    throw new AppError(502, 'UPSTREAM_ERROR', 'Place search is temporarily unavailable.');
  }

  const rows = (await response.json()) as NominatimRow[];
  if (!Array.isArray(rows)) {
    return [];
  }

  const results: PlaceSearchResult[] = [];
  for (const row of rows) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const placeId = row.place_id !== undefined ? String(row.place_id) : '';
    if (!placeId) {
      continue;
    }
    results.push({
      name: primaryName(row),
      formattedAddress: row.display_name?.trim() ?? primaryName(row),
      latitude: lat,
      longitude: lon,
      placeId,
      provider: 'nominatim',
    });
  }
  return results;
}

/** Test helper */
export function resetNominatimThrottleForTests(): void {
  lastRequestAt = 0;
}
