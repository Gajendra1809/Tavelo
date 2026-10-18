import { Linking } from 'react-native';
import { buildMapsDirectionsUrl } from './mapsUrls';
import { canOpenMaps } from './placeDisplay';
import type { TaveloPlace } from '@/types/place';

export async function openMapsDirections(place: TaveloPlace): Promise<boolean> {
  if (!canOpenMaps(place)) {
    return false;
  }
  const url = buildMapsDirectionsUrl(place);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
