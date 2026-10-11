import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const ALLOWED_BOOKING_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_MEMORY_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

export const ALLOWED_MEMORY_CONTENT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_MEMORY_VIDEO_TYPES,
]);

export type UploadKind = 'avatar' | 'trip_cover' | 'trip_memory' | 'booking_attachment';

export type MemoryMediaType = 'image' | 'video';

export function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'application/pdf':
      return 'pdf';
    default:
      throw new Error('Unsupported content type.');
  }
}

export function normalizeMimeType(contentType: string): string {
  const lower = contentType.toLowerCase().trim();
  if (lower === 'image/jpg') {
    return 'image/jpeg';
  }
  return lower;
}

/** When storage returns application/octet-stream, infer type from the object key we issued. */
export function inferContentTypeFromObjectKey(objectKey: string): string | null {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.mp4')) {
    return 'video/mp4';
  }
  if (lower.endsWith('.mov')) {
    return 'video/quicktime';
  }
  return null;
}

export function resolveStoredContentType(
  reportedType: string,
  objectKey: string,
  allowed: Set<string>,
): string {
  const normalized = normalizeMimeType(reportedType);
  if (allowed.has(normalized) && normalized !== 'application/octet-stream') {
    return normalized;
  }
  const inferred = inferContentTypeFromObjectKey(objectKey);
  if (inferred && allowed.has(inferred)) {
    return inferred;
  }
  return normalized;
}

export function assertAllowedBookingDocumentType(contentType: string): void {
  const normalized = normalizeMimeType(contentType);
  if (!ALLOWED_BOOKING_DOCUMENT_TYPES.has(normalized)) {
    throw new Error('Use a PDF, JPEG, PNG, or WebP document.');
  }
}

export function memoryMediaTypeForContentType(contentType: string): MemoryMediaType {
  if (ALLOWED_IMAGE_TYPES.has(contentType)) {
    return 'image';
  }
  if (ALLOWED_MEMORY_VIDEO_TYPES.has(contentType)) {
    return 'video';
  }
  throw new Error('Use a supported photo or video format.');
}

export function assertAllowedMemoryContentType(contentType: string): void {
  memoryMediaTypeForContentType(contentType);
}

export function assertAllowedContentType(contentType: string): void {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }
}

export function maxBytesForKind(
  kind: UploadKind,
  avatarMax: number,
  coverMax: number,
  memoryImageMax = coverMax,
  memoryVideoMax = coverMax,
): number {
  if (kind === 'avatar') {
    return avatarMax;
  }
  if (kind === 'trip_memory') {
    return memoryImageMax;
  }
  return coverMax;
}

export function maxBytesForMemoryContentType(
  contentType: string,
  memoryImageMax: number,
  memoryVideoMax: number,
): number {
  const kind = memoryMediaTypeForContentType(contentType);
  return kind === 'video' ? memoryVideoMax : memoryImageMax;
}

export function buildAvatarObjectKey(userId: string, contentType: string): string {
  assertObjectId(userId, 'user id');
  const ext = extensionForContentType(contentType);
  return `users/${userId}/avatar/${randomUUID()}.${ext}`;
}

export function buildTripCoverObjectKey(tripId: string, contentType: string): string {
  assertObjectId(tripId, 'trip id');
  const ext = extensionForContentType(contentType);
  return `trips/${tripId}/cover/${randomUUID()}.${ext}`;
}

export function assertAvatarObjectKey(userId: string, objectKey: string): void {
  assertObjectId(userId, 'user id');
  const prefix = `users/${userId}/avatar/`;
  if (!objectKey.startsWith(prefix) || objectKey.length <= prefix.length) {
    throw new Error('The object key does not match this user.');
  }
}

export function assertTripCoverObjectKey(tripId: string, objectKey: string): void {
  assertObjectId(tripId, 'trip id');
  const prefix = `trips/${tripId}/cover/`;
  if (!objectKey.startsWith(prefix) || objectKey.length <= prefix.length) {
    throw new Error('The object key does not match this trip.');
  }
}

export function buildTripMemoryObjectKey(tripId: string, contentType: string): string {
  assertObjectId(tripId, 'trip id');
  memoryMediaTypeForContentType(contentType);
  const ext = extensionForContentType(contentType);
  return `trips/${tripId}/media/${randomUUID()}.${ext}`;
}

export function assertTripMemoryObjectKey(tripId: string, objectKey: string): void {
  assertObjectId(tripId, 'trip id');
  const prefix = `trips/${tripId}/media/`;
  if (!objectKey.startsWith(prefix) || objectKey.length <= prefix.length) {
    throw new Error('The object key does not match this trip.');
  }
}

export function buildBookingAttachmentObjectKey(
  tripId: string,
  bookingId: string,
  contentType: string,
): string {
  assertObjectId(tripId, 'trip id');
  assertObjectId(bookingId, 'booking id');
  assertAllowedBookingDocumentType(contentType);
  const ext = extensionForContentType(contentType);
  return `trips/${tripId}/bookings/${bookingId}/${randomUUID()}.${ext}`;
}

export function assertBookingAttachmentObjectKey(
  tripId: string,
  bookingId: string,
  objectKey: string,
): void {
  assertObjectId(tripId, 'trip id');
  assertObjectId(bookingId, 'booking id');
  const prefix = `trips/${tripId}/bookings/${bookingId}/`;
  if (!objectKey.startsWith(prefix) || objectKey.length <= prefix.length) {
    throw new Error('The object key does not match this booking.');
  }
}

function assertObjectId(value: string, label: string): void {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Use a valid ${label}.`);
  }
}
