import type { PlaceDocument } from './place.model';
import type { TaveloPlaceInput } from './place.schema';

export type TaveloPlaceResponse = {
  name: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  provider: string | null;
  source: 'manual' | 'provider';
  verified: boolean;
};

export function toPlaceResponse(place: PlaceDocument | null | undefined): TaveloPlaceResponse | null {
  if (!place || !place.name?.trim()) {
    return null;
  }
  return {
    name: place.name.trim(),
    formattedAddress: place.formattedAddress?.trim() ? place.formattedAddress.trim() : null,
    latitude: typeof place.latitude === 'number' ? place.latitude : null,
    longitude: typeof place.longitude === 'number' ? place.longitude : null,
    placeId: place.placeId?.trim() ? place.placeId.trim() : null,
    provider: place.provider?.trim() ? place.provider.trim() : null,
    source: place.source === 'provider' ? 'provider' : 'manual',
    verified: Boolean(place.verified),
  };
}

export function toPlaceDocument(input: TaveloPlaceInput): PlaceDocument {
  return {
    name: input.name.trim(),
    formattedAddress: input.formattedAddress,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    placeId: input.placeId,
    provider: input.provider,
    source: input.source,
    verified: input.verified,
  };
}

/** Legacy string column kept for search and older clients. */
export function legacyLabelFromPlace(place: TaveloPlaceInput, maxLength: number): string {
  const name = place.name.trim();
  if (name.length <= maxLength) {
    return name;
  }
  return name.slice(0, maxLength);
}

export function manualPlaceFromLabel(label: string, maxLength: number): TaveloPlaceInput | null {
  const name = label.trim();
  if (!name) {
    return null;
  }
  return {
    name: name.length <= maxLength ? name : name.slice(0, maxLength),
    formattedAddress: null,
    latitude: null,
    longitude: null,
    placeId: null,
    provider: null,
    source: 'manual',
    verified: false,
  };
}
