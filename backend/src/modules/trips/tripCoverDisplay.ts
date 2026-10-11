import { getStorageConfig } from '../../config/storageEnv';
import { createPresignedGetUrl } from '../storage/objectStore';
import type { TripRecord } from './trip.mapper';

export async function resolveCoverImageUrl(record: TripRecord): Promise<string | null> {
  const key = record.coverObjectKey;
  if (key) {
    if (!getStorageConfig().enabled) {
      return null;
    }
    try {
      return await createPresignedGetUrl(key);
    } catch {
      return null;
    }
  }
  return record.coverImageUrl ? record.coverImageUrl : null;
}
