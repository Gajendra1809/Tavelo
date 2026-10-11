import { TRIPS_PATH, USERS_ME_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { AuthUser } from '@/types/auth';
import type { Trip } from '@/types/trip';

type UploadIntent = {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
};

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function mimeFromUri(uri: string, fallback = 'image/jpeg'): string {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return fallback;
}

async function putToPresignedUrl(uploadUrl: string, uri: string, contentType: string): Promise<void> {
  const file = await fetch(uri);
  const blob = await file.blob();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });
  if (!response.ok) {
    throw new Error('Could not upload the image to storage.');
  }
}

async function uploadViaIntent<T>(
  intentPath: string,
  completePath: string,
  uri: string,
  contentType: string,
  byteSize: number,
): Promise<T> {
  if (!allowedMime.has(contentType)) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }
  const intent = await apiRequest<UploadIntent>(intentPath, {
    method: 'POST',
    body: JSON.stringify({ contentType, byteSize }),
  });
  await putToPresignedUrl(intent.uploadUrl, uri, contentType);
  return apiRequest<T>(completePath, {
    method: 'POST',
    body: JSON.stringify({ objectKey: intent.objectKey }),
  });
}

export async function uploadAvatarFromUri(
  uri: string,
  contentType: string,
  byteSize: number,
): Promise<AuthUser> {
  return uploadViaIntent<AuthUser>(
    `${USERS_ME_PATH}/avatar/upload-intent`,
    `${USERS_ME_PATH}/avatar/complete`,
    uri,
    contentType,
    byteSize,
  );
}

export async function deleteAvatar(): Promise<AuthUser> {
  return apiRequest<AuthUser>(`${USERS_ME_PATH}/avatar`, { method: 'DELETE' });
}

export async function uploadTripCoverFromUri(
  tripId: string,
  uri: string,
  contentType: string,
  byteSize: number,
): Promise<Trip> {
  const tripBase = `${TRIPS_PATH}/${encodeURIComponent(tripId)}`;
  return uploadViaIntent<Trip>(
    `${tripBase}/cover/upload-intent`,
    `${tripBase}/cover/complete`,
    uri,
    contentType,
    byteSize,
  );
}

export async function deleteTripCover(tripId: string): Promise<Trip> {
  return apiRequest<Trip>(`${TRIPS_PATH}/${encodeURIComponent(tripId)}/cover`, { method: 'DELETE' });
}
