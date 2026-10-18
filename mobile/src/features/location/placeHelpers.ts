import type { PlaceSearchHit, TaveloPlace } from '@/types/place';

export function createManualPlace(name: string, formattedAddress?: string): TaveloPlace {
  const trimmedName = name.trim();
  const trimmedAddress = formattedAddress?.trim() || null;
  return {
    name: trimmedName,
    formattedAddress: trimmedAddress,
    latitude: null,
    longitude: null,
    placeId: null,
    provider: null,
    source: 'manual',
    verified: false,
  };
}

export function searchHitToPlace(hit: PlaceSearchHit): TaveloPlace {
  return {
    name: hit.name,
    formattedAddress: hit.formattedAddress,
    latitude: hit.latitude,
    longitude: hit.longitude,
    placeId: hit.placeId,
    provider: hit.provider,
    source: 'provider',
    verified: true,
  };
}

export function placeFromLegacyLabel(label: string): TaveloPlace | null {
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }
  return createManualPlace(trimmed);
}

export function resolvePlace(
  structured: TaveloPlace | null | undefined,
  legacyLabel: string | null | undefined,
): TaveloPlace | null {
  if (structured?.name?.trim()) {
    return structured;
  }
  return placeFromLegacyLabel(legacyLabel ?? '');
}
