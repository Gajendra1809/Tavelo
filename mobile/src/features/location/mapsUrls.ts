import { placeMapsQuery } from './placeDisplay';
import { hasVerifiedCoordinates } from '@/features/location/types';
import type { TaveloPlace } from '@/types/place';

const MAPS_BASE = 'https://www.google.com/maps';

function encodeQuery(value: string): string {
  return encodeURIComponent(value.trim());
}

export function buildMapsDirectionsUrl(place: TaveloPlace): string {
  if (hasVerifiedCoordinates(place)) {
    return `${MAPS_BASE}/dir/?api=1&destination=${place.latitude},${place.longitude}`;
  }
  const query = encodeQuery(placeMapsQuery(place));
  return `${MAPS_BASE}/dir/?api=1&destination=${query}`;
}

export function buildMapsSearchUrl(place: TaveloPlace): string {
  if (hasVerifiedCoordinates(place)) {
    return `${MAPS_BASE}/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const query = encodeQuery(placeMapsQuery(place));
  return `${MAPS_BASE}/search/?api=1&query=${query}`;
}
