import { createPresignedGetUrl } from '../storage/objectStore';
import type { MemoryDocument } from './memory.model';

export type MemoryUploader = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type MemoryItemResponse = {
  id: string;
  tripId: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  byteSize: number;
  originalFilename: string;
  caption: string;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  objectKey: string;
  thumbnailObjectKey: string | null;
  uploader: MemoryUploader;
};

export async function toMemoryItemResponse(
  doc: MemoryDocument,
  uploader: MemoryUploader,
): Promise<MemoryItemResponse> {
  let mediaUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  try {
    mediaUrl = await createPresignedGetUrl(doc.objectKey);
    if (doc.thumbnailObjectKey) {
      thumbnailUrl = await createPresignedGetUrl(doc.thumbnailObjectKey);
    } else if (doc.mediaType === 'image') {
      thumbnailUrl = mediaUrl;
    }
  } catch {
    mediaUrl = null;
    thumbnailUrl = null;
  }

  return {
    id: doc._id.toString(),
    tripId: doc.tripId.toString(),
    mediaType: doc.mediaType,
    mimeType: doc.mimeType,
    byteSize: doc.byteSize,
    originalFilename: doc.originalFilename ?? '',
    caption: doc.caption ?? '',
    capturedAt: doc.capturedAt ? doc.capturedAt.toISOString().slice(0, 10) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    mediaUrl,
    thumbnailUrl,
    objectKey: doc.objectKey,
    thumbnailObjectKey: doc.thumbnailObjectKey ?? null,
    uploader,
  };
}
