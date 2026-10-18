export type PlaceSource = 'manual' | 'provider';

export type TaveloPlace = {
  name: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  provider: string | null;
  source: PlaceSource;
  verified: boolean;
};

export type PlaceSearchHit = {
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  provider: string;
};
