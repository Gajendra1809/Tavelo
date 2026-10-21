import type { TaveloPlace } from '@/types/place';

/** Weather is shown only for search-picked destinations with verified coordinates. */
export function isWeatherEligiblePlace(place: TaveloPlace | null | undefined): boolean {
  if (!place) {
    return false;
  }
  if (place.source === 'manual') {
    return false;
  }
  if (!place.verified) {
    return false;
  }
  if (place.latitude == null || place.longitude == null) {
    return false;
  }
  return Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}
