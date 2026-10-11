import { AppError } from '../../utils/AppError';
import { assertStorageEnabled, StorageConfigError } from '../../config/storageEnv';
import { getSupabaseAdmin, storageBucket } from './supabaseClient';

export function assertObjectStorageAvailable(): void {
  try {
    assertStorageEnabled();
  } catch (error) {
    if (error instanceof StorageConfigError) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Photo uploads are not available yet.');
    }
    throw error;
  }
}

export async function createPresignedPutUrl(
  objectKey: string,
  _contentType: string,
  _byteSize: number,
): Promise<{ uploadUrl: string; expiresIn: number }> {
  const config = assertStorageEnabled();
  const { data, error } = await getSupabaseAdmin()
    .storage.from(storageBucket())
    .createSignedUploadUrl(objectKey, { upsert: true });

  if (error || !data?.signedUrl) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      error?.message ?? 'Could not prepare an upload URL.',
    );
  }

  return { uploadUrl: data.signedUrl, expiresIn: config.signedUrlTtlSeconds };
}

const signedGetUrlCache = new Map<string, { url: string; expiresAtMs: number }>();

/** Buffer before expiry so clients never receive a URL about to expire. */
const SIGN_CACHE_SKEW_MS = 5_000;

export function clearSignedGetUrlCacheForTests(): void {
  signedGetUrlCache.clear();
}

export async function createPresignedGetUrl(objectKey: string): Promise<string> {
  const config = assertStorageEnabled();
  const now = Date.now();
  const cached = signedGetUrlCache.get(objectKey);
  if (cached && cached.expiresAtMs - SIGN_CACHE_SKEW_MS > now) {
    return cached.url;
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(storageBucket())
    .createSignedUrl(objectKey, config.signedUrlTtlSeconds);

  if (error || !data?.signedUrl) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      error?.message ?? 'Could not prepare a download URL.',
    );
  }

  signedGetUrlCache.set(objectKey, {
    url: data.signedUrl,
    expiresAtMs: now + config.signedUrlTtlSeconds * 1000,
  });

  return data.signedUrl;
}

export async function headStoredObject(
  objectKey: string,
): Promise<{ contentType: string; contentLength: number }> {
  const { data, error } = await getSupabaseAdmin().storage.from(storageBucket()).download(objectKey);

  if (error || !data) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The uploaded file was not found in storage.');
  }

  return {
    contentType: data.type || 'application/octet-stream',
    contentLength: data.size,
  };
}

export async function deleteStoredObject(objectKey: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(storageBucket()).remove([objectKey]);
  if (error) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', error.message);
  }
}

export async function tryDeleteStoredObject(objectKey: string | null | undefined): Promise<void> {
  if (!objectKey) {
    return;
  }
  try {
    await deleteStoredObject(objectKey);
  } catch {
    // Best-effort cleanup; orphaned objects can be removed manually.
  }
}
