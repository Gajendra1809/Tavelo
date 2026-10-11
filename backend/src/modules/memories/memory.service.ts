import mongoose from 'mongoose';
import { getStorageConfig } from '../../config/storageEnv';
import { AppError } from '../../utils/AppError';
import { requireTripMember } from '../trips/trip.service';
import { dateOnlyToUtc } from '../trips/trip.mapper';
import { loadUserSummaries } from '../users/user.service';
import {
  assertObjectStorageAvailable,
  createPresignedPutUrl,
  headStoredObject,
  tryDeleteStoredObject,
} from '../storage/objectStore';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MEMORY_CONTENT_TYPES,
  assertAllowedContentType,
  assertAllowedMemoryContentType,
  resolveStoredContentType,
  assertTripMemoryObjectKey,
  buildTripMemoryObjectKey,
  maxBytesForMemoryContentType,
  memoryMediaTypeForContentType,
} from '../storage/policy';
import { MemoryModel, type MemoryDocument } from './memory.model';
import { toMemoryItemResponse, type MemoryItemResponse } from './memory.mapper';
import type {
  CreateMemoryInput,
  ListMemoriesQuery,
  MemoryUploadIntentInput,
  UpdateMemoryCaptionInput,
} from './memory.schema';

export type MemoriesListResponse = {
  items: MemoryItemResponse[];
  nextCursor: string | null;
  total: number;
  photoCount: number;
  videoCount: number;
};

export async function listTripMemories(
  userId: string,
  tripId: string,
  query: ListMemoriesQuery,
): Promise<MemoriesListResponse> {
  await requireTripMember(userId, tripId);
  assertValidTripId(tripId);

  const filter =
    query.filter === 'all' ? {} : ({ mediaType: query.filter } as { mediaType: 'image' | 'video' });
  const baseFilter = { tripId: new mongoose.Types.ObjectId(tripId), ...filter };

  const [total, photoCount, videoCount] = await Promise.all([
    MemoryModel.countDocuments({ tripId: baseFilter.tripId }),
    MemoryModel.countDocuments({ tripId: baseFilter.tripId, mediaType: 'image' }),
    MemoryModel.countDocuments({ tripId: baseFilter.tripId, mediaType: 'video' }),
  ]);

  const cursor = decodeCursor(query.cursor);
  const findFilter = cursor
    ? {
        ...baseFilter,
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      }
    : baseFilter;

  const docs = await MemoryModel.find(findFilter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean();

  const page = docs.slice(0, query.limit);
  const hasMore = docs.length > query.limit;
  const profiles = await loadUserSummaries(page.map((doc) => doc.uploadedBy.toString()));
  const items = await Promise.all(
    page.map((doc) =>
      toMemoryItemResponse(doc as MemoryDocument, uploaderFromMap(doc.uploadedBy.toString(), profiles)),
    ),
  );

  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, id: last._id as mongoose.Types.ObjectId })
      : null;

  return { items, nextCursor, total, photoCount, videoCount };
}

export async function createMemoryUploadIntent(
  userId: string,
  tripId: string,
  input: MemoryUploadIntentInput,
): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> {
  assertObjectStorageAvailable();
  await requireTripMember(userId, tripId);
  assertValidTripId(tripId);
  const config = getStorageConfig();
  try {
    assertAllowedMemoryContentType(input.contentType);
  } catch (error) {
    throw validationError(error);
  }
  const maxBytes = maxBytesForMemoryContentType(
    input.contentType,
    config.memoryImageMaxBytes,
    config.memoryVideoMaxBytes,
  );
  if (input.byteSize > maxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This file is too large.');
  }

  const objectKey = buildTripMemoryObjectKey(tripId, input.contentType);
  const { uploadUrl, expiresIn } = await createPresignedPutUrl(
    objectKey,
    input.contentType,
    input.byteSize,
  );
  return { objectKey, uploadUrl, expiresIn };
}

export async function createTripMemory(
  userId: string,
  tripId: string,
  input: CreateMemoryInput,
): Promise<MemoryItemResponse> {
  assertObjectStorageAvailable();
  const trip = await requireTripMember(userId, tripId);
  assertValidTripId(tripId);
  const config = getStorageConfig();
  try {
    assertTripMemoryObjectKey(tripId, input.objectKey);
  } catch (error) {
    throw validationError(error);
  }

  const existing = await MemoryModel.findOne({ objectKey: input.objectKey });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'This upload was already saved.');
  }

  const head = await headStoredObject(input.objectKey);
  const contentType = resolveStoredContentType(
    head.contentType,
    input.objectKey,
    ALLOWED_MEMORY_CONTENT_TYPES,
  );
  try {
    assertAllowedMemoryContentType(contentType);
  } catch (error) {
    await tryDeleteStoredObject(input.objectKey);
    throw validationError(error);
  }
  const maxBytes = maxBytesForMemoryContentType(
    contentType,
    config.memoryImageMaxBytes,
    config.memoryVideoMaxBytes,
  );
  if (head.contentLength <= 0 || head.contentLength > maxBytes) {
    await tryDeleteStoredObject(input.objectKey);
    throw new AppError(400, 'VALIDATION_ERROR', 'The uploaded file does not match the request.');
  }

  const mediaType = memoryMediaTypeForContentType(contentType);
  let thumbnailObjectKey: string | null = null;
  if (input.thumbnailObjectKey) {
    try {
      assertTripMemoryObjectKey(tripId, input.thumbnailObjectKey);
      const thumbHead = await headStoredObject(input.thumbnailObjectKey);
      const thumbType = resolveStoredContentType(
        thumbHead.contentType,
        input.thumbnailObjectKey,
        ALLOWED_IMAGE_TYPES,
      );
      assertAllowedContentType(thumbType);
      if (thumbHead.contentLength <= 0 || thumbHead.contentLength > config.avatarMaxBytes) {
        await tryDeleteStoredObject(input.objectKey);
        await tryDeleteStoredObject(input.thumbnailObjectKey);
        throw new AppError(400, 'VALIDATION_ERROR', 'The video thumbnail is invalid.');
      }
      thumbnailObjectKey = input.thumbnailObjectKey;
    } catch (error) {
      await tryDeleteStoredObject(input.objectKey);
      await tryDeleteStoredObject(input.thumbnailObjectKey);
      if (error instanceof AppError) {
        throw error;
      }
      throw validationError(error);
    }
  }

  let capturedAt: Date | null = null;
  if (input.capturedAt) {
    capturedAt = dateOnlyToUtc(input.capturedAt);
  }

  let doc: MemoryDocument;
  try {
    doc = await MemoryModel.create({
      tripId: trip._id,
      uploadedBy: userId,
      mediaType,
      objectKey: input.objectKey,
      thumbnailObjectKey,
      mimeType: head.contentType,
      byteSize: head.contentLength,
      originalFilename: input.originalFilename ?? '',
      caption: input.caption ?? '',
      capturedAt,
    });
  } catch (error) {
    await tryDeleteStoredObject(input.objectKey);
    await tryDeleteStoredObject(thumbnailObjectKey);
    throw error;
  }

  const profiles = await loadUserSummaries([userId]);
  return toMemoryItemResponse(doc, uploaderFromMap(userId, profiles));
}

export async function updateMemoryCaption(
  userId: string,
  tripId: string,
  mediaId: string,
  input: UpdateMemoryCaptionInput,
): Promise<MemoryItemResponse> {
  const trip = await requireTripMember(userId, tripId);
  const doc = await findMemoryForTrip(tripId, mediaId);
  assertCanMutateMemory(userId, doc, trip.ownerId?.toString());
  await MemoryModel.updateOne({ _id: doc._id }, { caption: input.caption });
  doc.caption = input.caption;
  const profiles = await loadUserSummaries([doc.uploadedBy.toString()]);
  return toMemoryItemResponse(doc, uploaderFromMap(doc.uploadedBy.toString(), profiles));
}

export async function deleteTripMemory(
  userId: string,
  tripId: string,
  mediaId: string,
): Promise<void> {
  const doc = await findMemoryForTrip(tripId, mediaId);
  const trip = await requireTripMember(userId, tripId);
  assertCanMutateMemory(userId, doc, trip.ownerId?.toString());

  const objectKey = doc.objectKey;
  const thumbKey = doc.thumbnailObjectKey;
  await MemoryModel.deleteOne({ _id: doc._id });
  await tryDeleteStoredObject(objectKey);
  await tryDeleteStoredObject(thumbKey);
}

export async function deleteMemoriesForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  const memories = await MemoryModel.find({ tripId }).select('objectKey thumbnailObjectKey');
  await MemoryModel.deleteMany({ tripId });
  for (const memory of memories) {
    await tryDeleteStoredObject(memory.objectKey);
    await tryDeleteStoredObject(memory.thumbnailObjectKey);
  }
}

function assertCanMutateMemory(
  userId: string,
  doc: MemoryDocument,
  tripOwnerId?: string | null,
): void {
  const isUploader = doc.uploadedBy.toString() === userId;
  const isOwner = tripOwnerId !== undefined && tripOwnerId !== null && tripOwnerId === userId;
  if (!isUploader && !isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change this memory.');
  }
}

async function findMemoryForTrip(tripId: string, mediaId: string): Promise<MemoryDocument> {
  assertValidTripId(tripId);
  if (!mongoose.isValidObjectId(mediaId)) {
    throw new AppError(404, 'NOT_FOUND', 'Memory not found.');
  }
  const doc = await MemoryModel.findOne({
    _id: mediaId,
    tripId: new mongoose.Types.ObjectId(tripId),
  });
  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Memory not found.');
  }
  return doc;
}

function uploaderFromMap(
  userId: string,
  profiles: Awaited<ReturnType<typeof loadUserSummaries>>,
): { id: string; name: string; avatarUrl: string | null } {
  const profile = profiles.get(userId);
  return {
    id: userId,
    name: profile?.name ?? 'Traveler',
    avatarUrl: profile?.avatarUrl ?? null,
  };
}

function assertValidTripId(tripId: string): void {
  if (!mongoose.isValidObjectId(tripId)) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }
}

function validationError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : 'Invalid upload request.';
  return new AppError(400, 'VALIDATION_ERROR', message);
}

type MemoryCursor = { createdAt: Date; id: mongoose.Types.ObjectId };

function encodeCursor(cursor: MemoryCursor): string {
  return Buffer.from(
    JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id.toString() }),
  ).toString('base64url');
}

function decodeCursor(raw: string | undefined): MemoryCursor | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      c?: string;
      i?: string;
    };
    if (!parsed.c || !parsed.i || !mongoose.isValidObjectId(parsed.i)) {
      return null;
    }
    return { createdAt: new Date(parsed.c), id: new mongoose.Types.ObjectId(parsed.i) };
  } catch {
    return null;
  }
}
