import type { TaveloPlace } from '@/types/place';

export type { PlaceSearchHit, PlaceSource, TaveloPlace } from '@/types/place';

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function hasVerifiedCoordinates(place: TaveloPlace): boolean {
  return (
    place.verified &&
    place.latitude !== null &&
    place.longitude !== null &&
    isValidLatitude(place.latitude) &&
    isValidLongitude(place.longitude)
  );
}
