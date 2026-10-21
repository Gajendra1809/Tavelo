import type { PlaceSearchResult } from './place.schema';

const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
const UPSTREAM_TIMEOUT_MS = 12_000;

type PhotonFeature = {
  type?: string;
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

function photonFormattedAddress(props: NonNullable<PhotonFeature['properties']>): string {
  const parts = [props.name, props.street, props.city, props.state, props.postcode, props.country].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  const unique = [...new Set(parts.map((p) => p.trim()))];
  if (unique.length > 0) {
    return unique.join(', ');
  }
  return props.name?.trim() || 'Place';
}

export function mapPhotonFeatures(features: PhotonFeature[], limit: number): PlaceSearchResult[] {
  const results: PlaceSearchResult[] = [];
  for (const feature of features) {
    if (results.length >= limit) {
      break;
    }
    const coords = feature.geometry?.coordinates;
    const props = feature.properties;
    if (!coords || coords.length < 2 || !props) {
      continue;
    }
    const lon = coords[0];
    const lat = coords[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const osmId = props.osm_id;
    if (osmId === undefined) {
      continue;
    }
    const name = props.name?.trim() || photonFormattedAddress(props).split(',')[0]?.trim() || 'Place';
    results.push({
      name,
      formattedAddress: photonFormattedAddress(props),
      latitude: lat,
      longitude: lon,
      placeId: `photon:${props.osm_type ?? 'N'}:${osmId}`,
      provider: 'photon',
    });
  }
  return results;
}

export async function searchPlacesPhoton(query: string, limit: number): Promise<PlaceSearchResult[]> {
  const url = new URL(PHOTON_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Photon HTTP ${response.status}`);
  }

  const body = (await response.json()) as PhotonResponse;
  const features = Array.isArray(body.features) ? body.features : [];
  return mapPhotonFeatures(features, limit);
}
