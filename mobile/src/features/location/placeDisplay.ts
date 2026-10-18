import { hasVerifiedCoordinates } from '@/features/location/types';
import type { TaveloPlace } from '@/types/place';

export function placePrimaryLine(place: TaveloPlace): string {
  return place.name.trim() || place.formattedAddress?.trim() || 'Location';
}

export function placeSecondaryLine(place: TaveloPlace): string | null {
  const address = place.formattedAddress?.trim();
  if (!address || address === place.name.trim()) {
    return null;
  }
  return address;
}

/** Best-effort query when coordinates are unavailable. */
export function placeMapsQuery(place: TaveloPlace): string {
  const address = place.formattedAddress?.trim();
  if (address) {
    return address;
  }
  return place.name.trim();
}

export function canOpenMaps(place: TaveloPlace): boolean {
  if (hasVerifiedCoordinates(place)) {
    return true;
  }
  return placeMapsQuery(place).length > 0;
}
