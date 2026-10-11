import mongoose from 'mongoose';
import { getStorageConfig } from '../../config/storageEnv';
import { AppError } from '../../utils/AppError';
import {
  assertObjectStorageAvailable,
  createPresignedPutUrl,
  headStoredObject,
  tryDeleteStoredObject,
} from '../storage/objectStore';
import {
  ALLOWED_IMAGE_TYPES,
  assertAllowedContentType,
  resolveStoredContentType,
  assertTripCoverObjectKey,
  buildTripCoverObjectKey,
  maxBytesForKind,
} from '../storage/policy';
import type { UploadCompleteInput, UploadIntentInput } from '../storage/storage.schema';
import { TripModel } from './trip.model';
import { assertOwnerTrip, type TripDocument } from './tripAccess';

export async function createTripCoverUploadIntent(
  ownerId: string,
  tripId: string,
  input: UploadIntentInput,
): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> {
  assertObjectStorageAvailable();
  await assertOwnerTrip(ownerId, tripId);
  const config = getStorageConfig();
  try {
    assertAllowedContentType(input.contentType);
  } catch (error) {
    throw validationError(error);
  }
  const maxBytes = maxBytesForKind('trip_cover', config.avatarMaxBytes, config.tripCoverMaxBytes);
  if (input.byteSize > maxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This image is too large.');
  }

  const objectKey = buildTripCoverObjectKey(tripId, input.contentType);
  const { uploadUrl, expiresIn } = await createPresignedPutUrl(
    objectKey,
    input.contentType,
    input.byteSize,
  );
  return { objectKey, uploadUrl, expiresIn };
}

export async function completeTripCoverUpload(
  ownerId: string,
  tripId: string,
  input: UploadCompleteInput,
): Promise<TripDocument> {
  assertObjectStorageAvailable();
  const trip = await assertOwnerTrip(ownerId, tripId);
  const config = getStorageConfig();
  try {
    assertTripCoverObjectKey(tripId, input.objectKey);
  } catch (error) {
    throw validationError(error);
  }

  const head = await headStoredObject(input.objectKey);
  const contentType = resolveStoredContentType(
    head.contentType,
    input.objectKey,
    ALLOWED_IMAGE_TYPES,
  );
  try {
    assertAllowedContentType(contentType);
  } catch (error) {
    throw validationError(error);
  }
  const maxBytes = maxBytesForKind('trip_cover', config.avatarMaxBytes, config.tripCoverMaxBytes);
  if (head.contentLength <= 0 || head.contentLength > maxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The uploaded file does not match the request.');
  }

  const previousKey = trip.coverObjectKey ?? null;
  trip.coverObjectKey = input.objectKey;
  trip.coverImageUrl = null;
  await trip.save();
  await tryDeleteStoredObject(previousKey);
  return trip;
}

export async function deleteTripCover(ownerId: string, tripId: string): Promise<TripDocument> {
  assertObjectStorageAvailable();
  const trip = await assertOwnerTrip(ownerId, tripId);
  const previousKey = trip.coverObjectKey ?? null;
  trip.coverObjectKey = null;
  await trip.save();
  await tryDeleteStoredObject(previousKey);
  return trip;
}

function validationError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : 'Invalid upload request.';
  return new AppError(400, 'VALIDATION_ERROR', message);
}
