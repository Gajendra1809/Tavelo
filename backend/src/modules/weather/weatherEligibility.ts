import type { PlaceDocument } from '../places/place.model';

export type WeatherUnavailableReason = 'manual_location' | 'missing_coordinates';

export function weatherCoordinatesFromPlace(
  place: PlaceDocument | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!place) {
    return null;
  }
  if (place.source === 'manual') {
    return null;
  }
  if (!place.verified) {
    return null;
  }
  const lat = place.latitude;
  const lon = place.longitude;
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { latitude: lat, longitude: lon };
}

export function weatherUnavailableReason(
  place: PlaceDocument | null | undefined,
): WeatherUnavailableReason | null {
  if (!place) {
    return 'missing_coordinates';
  }
  if (place.source === 'manual') {
    return 'manual_location';
  }
  if (!weatherCoordinatesFromPlace(place)) {
    return 'missing_coordinates';
  }
  return null;
}

export function coordinateCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}
