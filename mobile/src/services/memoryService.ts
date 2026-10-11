import * as VideoThumbnails from 'expo-video-thumbnails';
import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { MemoryFilter, TripMemoriesPage, TripMemoryItem } from '@/types/memory';

type UploadIntent = {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
};

const allowedImage = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedVideo = new Set(['video/mp4', 'video/quicktime']);

export function memoryMimeFromUri(uri: string, fallback = 'image/jpeg'): string {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.mp4')) {
    return 'video/mp4';
  }
  if (lower.endsWith('.mov')) {
    return 'video/quicktime';
  }
  return fallback;
}

export function isAllowedMemoryMime(contentType: string): boolean {
  return allowedImage.has(contentType) || allowedVideo.has(contentType);
}

function tripMemoriesBase(tripId: string): string {
  return `${TRIPS_PATH}/${encodeURIComponent(tripId)}/memories`;
}

export async function listTripMemories(
  tripId: string,
  options: { filter?: MemoryFilter; limit?: number; cursor?: string | null } = {},
): Promise<TripMemoriesPage> {
  const params = new URLSearchParams();
  if (options.filter && options.filter !== 'all') {
    params.set('filter', options.filter);
  }
  if (options.limit) {
    params.set('limit', String(options.limit));
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  const query = params.toString();
  return apiRequest<TripMemoriesPage>(`${tripMemoriesBase(tripId)}${query ? `?${query}` : ''}`);
}

async function putToSignedUrl(
  uploadUrl: string,
  uri: string,
  contentType: string,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  onProgress?.(0.1);
  const file = await fetch(uri);
  const blob = await file.blob();
  onProgress?.(0.35);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  onProgress?.(1);
  if (!response.ok) {
    throw new Error('Could not upload the file to storage.');
  }
}

export async function uploadTripMemory(input: {
  tripId: string;
  uri: string;
  contentType: string;
  byteSize: number;
  caption?: string;
  originalFilename?: string;
  onProgress?: (ratio: number) => void;
}): Promise<TripMemoryItem> {
  if (!isAllowedMemoryMime(input.contentType)) {
    throw new Error('Use a JPEG, PNG, WebP, MP4, or MOV file.');
  }
  if (input.byteSize <= 0) {
    throw new Error('Could not read the selected file size.');
  }
  const base = tripMemoriesBase(input.tripId);
  const intent = await apiRequest<UploadIntent>(`${base}/upload-intent`, {
    method: 'POST',
    body: JSON.stringify({ contentType: input.contentType, byteSize: input.byteSize }),
  });
  await putToSignedUrl(intent.uploadUrl, input.uri, input.contentType, input.onProgress);

  let thumbnailObjectKey: string | undefined;
  if (allowedVideo.has(input.contentType)) {
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(input.uri, {
        time: 800,
        quality: 0.72,
      });
      const thumbFile = await fetch(thumbUri);
      const thumbBlob = await thumbFile.blob();
      const thumbIntent = await apiRequest<UploadIntent>(`${base}/upload-intent`, {
        method: 'POST',
        body: JSON.stringify({ contentType: 'image/jpeg', byteSize: thumbBlob.size }),
      });
      const thumbPut = await fetch(thumbIntent.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: thumbBlob,
      });
      if (thumbPut.ok) {
        thumbnailObjectKey = thumbIntent.objectKey;
      }
    } catch {
      // Gallery can still derive a preview locally when needed.
    }
  }

  return apiRequest<TripMemoryItem>(base, {
    method: 'POST',
    body: JSON.stringify({
      objectKey: intent.objectKey,
      thumbnailObjectKey,
      caption: input.caption?.trim() || undefined,
      originalFilename: input.originalFilename,
    }),
  });
}

export async function updateMemoryCaption(
  tripId: string,
  mediaId: string,
  caption: string,
): Promise<TripMemoryItem> {
  return apiRequest<TripMemoryItem>(`${tripMemoriesBase(tripId)}/${encodeURIComponent(mediaId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ caption }),
  });
}

export async function deleteTripMemory(tripId: string, mediaId: string): Promise<void> {
  await apiRequest<{ deleted: true }>(`${tripMemoriesBase(tripId)}/${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  });
}
