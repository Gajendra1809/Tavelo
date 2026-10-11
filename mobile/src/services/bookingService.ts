import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { TRIPS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import { isAllowedBookingMime, normalizeBookingMime } from '@/lib/mimeTypes';
import {
  putLocalFileToSignedUrl,
  resolveLocalByteSize,
  stageLocalFileForUpload,
} from '@/services/storageUpload';
import type { BookingCategory, TripBooking, TripBookingsList } from '@/types/booking';

type UploadIntent = {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
};

function bookingsBase(tripId: string): string {
  return `${TRIPS_PATH}/${encodeURIComponent(tripId)}/bookings`;
}

export async function listTripBookings(
  tripId: string,
  category?: BookingCategory,
): Promise<TripBookingsList> {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest<TripBookingsList>(`${bookingsBase(tripId)}${params}`);
}

export async function getTripBooking(tripId: string, bookingId: string): Promise<TripBooking> {
  return apiRequest<TripBooking>(`${bookingsBase(tripId)}/${encodeURIComponent(bookingId)}`);
}

export async function createTripBooking(
  tripId: string,
  body: {
    title: string;
    category: BookingCategory;
    provider?: string;
    startDate: string;
    endDate?: string;
    location?: string;
    route?: string;
    bookingReference?: string;
    notes?: string;
  },
): Promise<TripBooking> {
  return apiRequest<TripBooking>(bookingsBase(tripId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateTripBooking(
  tripId: string,
  bookingId: string,
  body: Partial<{
    title: string;
    category: BookingCategory;
    provider: string;
    startDate: string;
    endDate: string;
    location: string;
    route: string;
    bookingReference: string;
    notes: string;
  }>,
): Promise<TripBooking> {
  return apiRequest<TripBooking>(`${bookingsBase(tripId)}/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteTripBooking(tripId: string, bookingId: string): Promise<void> {
  await apiRequest<{ deleted: true }>(
    `${bookingsBase(tripId)}/${encodeURIComponent(bookingId)}`,
    { method: 'DELETE' },
  );
}

export async function uploadBookingAttachment(input: {
  tripId: string;
  bookingId: string;
  uri: string;
  contentType: string;
  byteSize: number;
  originalFilename?: string;
  label?: string;
  onProgress?: (ratio: number) => void;
}): Promise<TripBooking> {
  const contentType = normalizeBookingMime(input.contentType, input.originalFilename ?? '');
  if (!isAllowedBookingMime(contentType)) {
    throw new Error('Use a PDF, JPEG, PNG, or WebP file.');
  }
  if (input.byteSize <= 0) {
    throw new Error('Could not read the selected file size.');
  }
  const base = `${bookingsBase(input.tripId)}/${encodeURIComponent(input.bookingId)}/attachments`;
  input.onProgress?.(0.1);
  const intent = await apiRequest<UploadIntent>(`${base}/upload-intent`, {
    method: 'POST',
    body: JSON.stringify({
      contentType,
      byteSize: input.byteSize,
      originalFilename: input.originalFilename,
      label: input.label,
    }),
  });
  input.onProgress?.(0.35);
  await putLocalFileToSignedUrl(intent.uploadUrl, input.uri, contentType, input.onProgress);
  input.onProgress?.(0.9);
  const booking = await apiRequest<TripBooking>(`${base}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      objectKey: intent.objectKey,
      originalFilename: input.originalFilename,
      label: input.label,
    }),
  });
  input.onProgress?.(1);
  return booking;
}

export async function deleteBookingAttachment(
  tripId: string,
  bookingId: string,
  attachmentId: string,
): Promise<TripBooking> {
  return apiRequest<TripBooking>(
    `${bookingsBase(tripId)}/${encodeURIComponent(bookingId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' },
  );
}

export type BookingPickedAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

async function finalizePickedAttachment(input: {
  uri: string;
  name: string;
  mimeType: string;
  fallbackSize: number;
}): Promise<BookingPickedAttachment> {
  const mimeType = normalizeBookingMime(input.mimeType, input.name);
  if (!isAllowedBookingMime(mimeType)) {
    throw new Error('Use a PDF, JPEG, PNG, or WebP file.');
  }
  const uri = await stageLocalFileForUpload(input.uri, mimeType);
  const size = await resolveLocalByteSize(uri, input.fallbackSize);
  if (size <= 0) {
    throw new Error('Could not read the selected file size.');
  }
  return { uri, name: input.name, mimeType, size };
}

/** Gallery photos — reliable on Android (same path as trip memories). */
export async function pickBookingImageFromLibrary(): Promise<BookingPickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to attach an image.');
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) {
    return null;
  }
  const asset = picked.assets[0];
  const name = asset.fileName ?? 'photo.jpg';
  return finalizePickedAttachment({
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? name,
    fallbackSize: asset.fileSize ?? 0,
  });
}

/** PDFs and files from the system document UI. */
export async function pickBookingFileFromDocuments(): Promise<BookingPickedAttachment | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    // Android Expo Go: cached DocumentPicker file:// paths are often unreadable; use content URI.
    copyToCacheDirectory: Platform.OS !== 'android',
    multiple: false,
  });
  if (picked.canceled || !picked.assets[0]) {
    return null;
  }
  const asset = picked.assets[0];
  return finalizePickedAttachment({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? asset.name,
    fallbackSize: asset.size ?? 0,
  });
}

/** @deprecated Prefer prompt + pickBookingImageFromLibrary / pickBookingFileFromDocuments */
export async function pickBookingDocument(): Promise<BookingPickedAttachment | null> {
  return pickBookingFileFromDocuments();
}
