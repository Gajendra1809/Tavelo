import { legacyLabelFromPlace, toPlaceDocument } from './place.mapper';
import type { TaveloPlaceInput } from './place.schema';
import type { PlaceDocument } from './place.model';

export type ResolvedLocationFields = {
  label: string | null;
  place: PlaceDocument | null;
};

export function resolveActivityLocation(
  input: { location?: string | null; place?: TaveloPlaceInput | null },
  maxLabelLength: number,
): ResolvedLocationFields {
  if (input.place !== undefined && input.place !== null) {
    return {
      label: legacyLabelFromPlace(input.place, maxLabelLength),
      place: toPlaceDocument(input.place),
    };
  }
  if (input.place === null) {
    const label = input.location?.trim() ? input.location.trim().slice(0, maxLabelLength) : null;
    return { label, place: null };
  }
  const label = input.location?.trim() ? input.location.trim().slice(0, maxLabelLength) : null;
  return { label, place: null };
}

export function resolveBookingLocation(
  input: { location?: string; place?: TaveloPlaceInput | null },
  maxLabelLength: number,
): { location: string; place: PlaceDocument | null } {
  if (input.place !== undefined && input.place !== null) {
    return {
      location: legacyLabelFromPlace(input.place, maxLabelLength),
      place: toPlaceDocument(input.place),
    };
  }
  if (input.place === null) {
    return {
      location: input.location?.trim().slice(0, maxLabelLength) ?? '',
      place: null,
    };
  }
  return {
    location: input.location?.trim().slice(0, maxLabelLength) ?? '',
    place: null,
  };
}
