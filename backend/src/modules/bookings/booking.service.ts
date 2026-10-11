import mongoose from 'mongoose';
import { getStorageConfig } from '../../config/storageEnv';
import { AppError } from '../../utils/AppError';
import { requireTripMember } from '../trips/trip.service';
import { dateOnlyToUtc, toDateOnly } from '../trips/trip.mapper';
import { loadUserSummaries } from '../users/user.service';
import {
  assertObjectStorageAvailable,
  createPresignedPutUrl,
  headStoredObject,
  tryDeleteStoredObject,
} from '../storage/objectStore';
import {
  assertAllowedBookingDocumentType,
  normalizeMimeType,
  resolveStoredContentType,
  ALLOWED_BOOKING_DOCUMENT_TYPES,
  assertBookingAttachmentObjectKey,
  buildBookingAttachmentObjectKey,
} from '../storage/policy';
import { loadActorName, notifyBookingEvent } from '../notifications/notification.service';
import { BookingModel, type BookingAttachmentDocument, type BookingDocument } from './booking.model';
import { toBookingResponse, type BookingResponse } from './booking.mapper';
import type {
  BookingAttachmentUploadIntentInput,
  CompleteBookingAttachmentInput,
  CreateBookingInput,
  ListBookingsQuery,
  UpdateBookingInput,
} from './booking.schema';

export async function listTripBookings(
  userId: string,
  tripId: string,
  query: ListBookingsQuery,
): Promise<{ bookings: BookingResponse[]; total: number }> {
  await requireTripMember(userId, tripId);
  assertValidTripId(tripId);

  const filter: { tripId: mongoose.Types.ObjectId; category?: string } = {
    tripId: new mongoose.Types.ObjectId(tripId),
  };
  if (query.category) {
    filter.category = query.category;
  }

  const docs = await BookingModel.find(filter).sort({ startDate: 1, _id: 1 }).lean();
  const userIds = new Set<string>();
  for (const doc of docs) {
    userIds.add(doc.createdBy.toString());
    for (const attachment of doc.attachments ?? []) {
      userIds.add(attachment.uploadedBy.toString());
    }
  }
  const profiles = await loadUserSummaries([...userIds]);

  const bookings = await Promise.all(
    docs.map((doc) =>
      toBookingResponse(
        doc as BookingDocument,
        creatorFromMap(doc.createdBy.toString(), profiles),
        attachmentUploadersMap(doc as BookingDocument, profiles),
      ),
    ),
  );

  return { bookings, total: bookings.length };
}

export async function getTripBooking(
  userId: string,
  tripId: string,
  bookingId: string,
): Promise<BookingResponse> {
  const doc = await findBookingForTrip(tripId, bookingId);
  await requireTripMember(userId, tripId);
  return mapBooking(doc);
}

export async function createTripBooking(
  userId: string,
  tripId: string,
  input: CreateBookingInput,
): Promise<BookingResponse> {
  const trip = await requireTripMember(userId, tripId);
  assertValidTripId(tripId);
  assertBookingDateWithinTrip(trip, input.startDate, input.endDate ?? input.startDate);

  const doc = await BookingModel.create({
    tripId: trip._id,
    title: input.title,
    category: input.category,
    provider: input.provider ?? '',
    startDate: dateOnlyToUtc(input.startDate),
    endDate: input.endDate ? dateOnlyToUtc(input.endDate) : null,
    location: input.location ?? '',
    route: input.route ?? '',
    bookingReference: input.bookingReference ?? '',
    notes: input.notes ?? '',
    createdBy: userId,
    attachments: [],
  });

  await notifyBookingEvent({
    actorId: userId,
    actorName: await loadActorName(userId),
    trip,
    bookingId: doc._id.toString(),
    bookingTitle: doc.title,
    kind: 'booking_created',
  });

  return mapBooking(doc);
}

export async function updateTripBooking(
  userId: string,
  tripId: string,
  bookingId: string,
  input: UpdateBookingInput,
): Promise<BookingResponse> {
  const trip = await requireTripMember(userId, tripId);
  const doc = await findBookingDocument(tripId, bookingId);
  assertCanMutateBooking(userId, doc, trip.ownerId?.toString());

  const nextStartStr = input.startDate ?? toDateOnly(doc.startDate);
  const nextEndStr =
    input.endDate !== undefined
      ? input.endDate || nextStartStr
      : doc.endDate
        ? toDateOnly(doc.endDate)
        : nextStartStr;
  assertBookingDateWithinTrip(trip, nextStartStr, nextEndStr);

  if (input.title !== undefined) {
    doc.title = input.title;
  }
  if (input.category !== undefined) {
    doc.category = input.category;
  }
  if (input.provider !== undefined) {
    doc.provider = input.provider;
  }
  if (input.startDate !== undefined) {
    doc.startDate = dateOnlyToUtc(input.startDate);
  }
  if (input.endDate !== undefined) {
    doc.endDate = input.endDate ? dateOnlyToUtc(input.endDate) : null;
  }
  if (input.location !== undefined) {
    doc.location = input.location;
  }
  if (input.route !== undefined) {
    doc.route = input.route;
  }
  if (input.bookingReference !== undefined) {
    doc.bookingReference = input.bookingReference;
  }
  if (input.notes !== undefined) {
    doc.notes = input.notes;
  }

  await doc.save();
  await notifyBookingEvent({
    actorId: userId,
    actorName: await loadActorName(userId),
    trip,
    bookingId: doc._id.toString(),
    bookingTitle: doc.title,
    kind: 'booking_updated',
  });
  return mapBooking(doc);
}

export async function deleteTripBooking(
  userId: string,
  tripId: string,
  bookingId: string,
): Promise<void> {
  const trip = await requireTripMember(userId, tripId);
  const doc = await findBookingDocument(tripId, bookingId);
  assertCanMutateBooking(userId, doc, trip.ownerId?.toString());

  const keys = doc.attachments.map((row) => row.objectKey);
  const bookingTitle = doc.title;
  const deletedBookingId = doc._id.toString();
  await BookingModel.deleteOne({ _id: doc._id });
  for (const key of keys) {
    await tryDeleteStoredObject(key);
  }
  await notifyBookingEvent({
    actorId: userId,
    actorName: await loadActorName(userId),
    trip,
    bookingId: deletedBookingId,
    bookingTitle,
    kind: 'booking_deleted',
  });
}

export async function createBookingAttachmentUploadIntent(
  userId: string,
  tripId: string,
  bookingId: string,
  input: BookingAttachmentUploadIntentInput,
): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> {
  assertObjectStorageAvailable();
  await requireTripMember(userId, tripId);
  await findBookingDocument(tripId, bookingId);

  const config = getStorageConfig();
  const contentType = normalizeMimeType(input.contentType);
  try {
    assertAllowedBookingDocumentType(contentType);
  } catch (error) {
    throw validationError(error);
  }
  if (input.byteSize > config.bookingAttachmentMaxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This file is too large.');
  }

  const objectKey = buildBookingAttachmentObjectKey(tripId, bookingId, contentType);
  const { uploadUrl, expiresIn } = await createPresignedPutUrl(
    objectKey,
    contentType,
    input.byteSize,
  );
  return { objectKey, uploadUrl, expiresIn };
}

export async function completeBookingAttachment(
  userId: string,
  tripId: string,
  bookingId: string,
  input: CompleteBookingAttachmentInput,
): Promise<BookingResponse> {
  assertObjectStorageAvailable();
  await requireTripMember(userId, tripId);
  const doc = await findBookingDocument(tripId, bookingId);
  const config = getStorageConfig();

  try {
    assertBookingAttachmentObjectKey(tripId, bookingId, input.objectKey);
  } catch (error) {
    throw validationError(error);
  }

  const duplicate = doc.attachments.some((row) => row.objectKey === input.objectKey);
  if (duplicate) {
    throw new AppError(409, 'CONFLICT', 'This upload was already attached.');
  }

  const head = await headStoredObject(input.objectKey);
  const contentType = resolveStoredContentType(
    head.contentType,
    input.objectKey,
    ALLOWED_BOOKING_DOCUMENT_TYPES,
  );
  try {
    assertAllowedBookingDocumentType(contentType);
  } catch (error) {
    await tryDeleteStoredObject(input.objectKey);
    throw validationError(error);
  }
  if (head.contentLength <= 0 || head.contentLength > config.bookingAttachmentMaxBytes) {
    await tryDeleteStoredObject(input.objectKey);
    throw new AppError(400, 'VALIDATION_ERROR', 'The uploaded file does not match the request.');
  }

  doc.attachments.push({
    objectKey: input.objectKey,
    originalFilename: input.originalFilename ?? '',
    mimeType: contentType,
    byteSize: head.contentLength,
    label: input.label ?? '',
    uploadedBy: new mongoose.Types.ObjectId(userId),
    uploadedAt: new Date(),
  } as BookingAttachmentDocument);

  await doc.save();
  return mapBooking(doc);
}

export async function deleteBookingAttachment(
  userId: string,
  tripId: string,
  bookingId: string,
  attachmentId: string,
): Promise<BookingResponse> {
  const trip = await requireTripMember(userId, tripId);
  const doc = await findBookingDocument(tripId, bookingId);
  const attachment = doc.attachments.id(attachmentId);
  if (!attachment) {
    throw new AppError(404, 'NOT_FOUND', 'Attachment not found.');
  }
  assertCanMutateAttachment(userId, doc, attachment, trip.ownerId?.toString());

  const objectKey = attachment.objectKey;
  attachment.deleteOne();
  await doc.save();
  await tryDeleteStoredObject(objectKey);
  return mapBooking(doc);
}

export async function deleteBookingsForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  const docs = await BookingModel.find({ tripId }).select('attachments');
  await BookingModel.deleteMany({ tripId });
  for (const doc of docs) {
    for (const attachment of doc.attachments) {
      await tryDeleteStoredObject(attachment.objectKey);
    }
  }
}

function assertCanMutateBooking(
  userId: string,
  doc: BookingDocument,
  tripOwnerId?: string | null,
): void {
  const isCreator = doc.createdBy.toString() === userId;
  const isOwner = tripOwnerId !== undefined && tripOwnerId !== null && tripOwnerId === userId;
  if (!isCreator && !isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change this booking.');
  }
}

function assertCanMutateAttachment(
  userId: string,
  doc: BookingDocument,
  attachment: BookingAttachmentDocument,
  tripOwnerId?: string | null,
): void {
  const isUploader = attachment.uploadedBy.toString() === userId;
  const isBookingCreator = doc.createdBy.toString() === userId;
  const isOwner = tripOwnerId !== undefined && tripOwnerId !== null && tripOwnerId === userId;
  if (!isUploader && !isBookingCreator && !isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot remove this attachment.');
  }
}

async function findBookingForTrip(tripId: string, bookingId: string): Promise<BookingDocument> {
  return findBookingDocument(tripId, bookingId);
}

async function findBookingDocument(tripId: string, bookingId: string): Promise<BookingDocument> {
  assertValidTripId(tripId);
  if (!mongoose.isValidObjectId(bookingId)) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found.');
  }
  const doc = await BookingModel.findOne({
    _id: bookingId,
    tripId: new mongoose.Types.ObjectId(tripId),
  });
  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found.');
  }
  return doc;
}

async function mapBooking(doc: BookingDocument): Promise<BookingResponse> {
  const userIds = new Set<string>([doc.createdBy.toString()]);
  for (const attachment of doc.attachments) {
    userIds.add(attachment.uploadedBy.toString());
  }
  const profiles = await loadUserSummaries([...userIds]);
  return toBookingResponse(
    doc,
    creatorFromMap(doc.createdBy.toString(), profiles),
    attachmentUploadersMap(doc, profiles),
  );
}

function creatorFromMap(
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

function attachmentUploadersMap(
  doc: BookingDocument,
  profiles: Awaited<ReturnType<typeof loadUserSummaries>>,
): Map<string, { id: string; name: string; avatarUrl: string | null }> {
  const map = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  for (const attachment of doc.attachments) {
    const id = attachment.uploadedBy.toString();
    map.set(id, creatorFromMap(id, profiles));
  }
  return map;
}

function assertBookingDateWithinTrip(
  trip: { startDate: Date; endDate: Date },
  startDate: string,
  endDate?: string,
): void {
  const tripStartStr = toDateOnly(trip.startDate);
  const tripEndStr = toDateOnly(trip.endDate);
  if (startDate < tripStartStr || startDate > tripEndStr) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Booking dates must fall within the trip dates.');
  }
  const end = endDate ?? startDate;
  if (end < startDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'End date cannot be before start date.');
  }
  if (end > tripEndStr) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Booking dates must fall within the trip dates.');
  }
}

function assertValidTripId(tripId: string): void {
  if (!mongoose.isValidObjectId(tripId)) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }
}

function validationError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : 'Invalid request.';
  return new AppError(400, 'VALIDATION_ERROR', message);
}
