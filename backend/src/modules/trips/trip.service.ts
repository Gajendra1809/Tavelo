import mongoose from 'mongoose';
import { loadUserSummaries } from '../users/user.service';
import { deleteActivitiesForTrip } from '../itinerary/activity.service';
import { deleteExpensesForTrip } from '../expenses/expense.service';
import { deleteInvitationsForTrip } from '../invitations/invitation.service';
import { AppError } from '../../utils/AppError';
import { tryDeleteStoredObject } from '../storage/objectStore';
import {
  dateOnlyToUtc,
  participantIds,
  toDateOnly,
  toTripResponse,
  type TripRecord,
  type TripResponse,
} from './trip.mapper';
import { resolveCoverImageUrl } from './tripCoverDisplay';
import { TripModel } from './trip.model';
import type { CreateTripInput, UpdateTripInput } from './trip.schema';

export async function listTrips(ownerId: string): Promise<TripResponse[]> {
  assertDatabaseConnected();
  const trips = await TripModel.find({
    $or: [{ ownerId }, { 'members.userId': ownerId }],
  })
    .sort({ startDate: 1, createdAt: 1 })
    .lean();
  const profiles = await loadUserSummaries(trips.flatMap((trip) => participantIds(trip)));
  return Promise.all(trips.map((trip) => toTripResponseWithCover(trip, profiles)));
}

export async function getTrip(ownerId: string, id: string): Promise<TripResponse> {
  const trip = await findAuthorizedTrip(ownerId, id);
  const profiles = await loadUserSummaries(participantIds(trip));
  return toTripResponseWithCover(trip, profiles);
}

export async function createTrip(ownerId: string, input: CreateTripInput): Promise<TripResponse> {
  assertDatabaseConnected();
  const trip = await TripModel.create({
    name: input.name,
    destination: input.destination,
    startDate: dateOnlyToUtc(input.startDate),
    endDate: dateOnlyToUtc(input.endDate),
    description: input.description,
    ownerId,
    members: [{ userId: ownerId, role: 'owner' }],
  });
  const profiles = await loadUserSummaries([ownerId]);
  return toTripResponseWithCover(trip, profiles);
}

export async function updateTrip(
  ownerId: string,
  id: string,
  input: UpdateTripInput,
): Promise<TripResponse> {
  const existing = await findAuthorizedTrip(ownerId, id);
  assertOwner(existing, ownerId);

  if (input.name !== undefined) {
    existing.name = input.name;
  }
  if (input.destination !== undefined) {
    existing.destination = input.destination;
  }
  if (input.description !== undefined) {
    existing.description = input.description;
  }
  if (input.startDate !== undefined) {
    existing.startDate = dateOnlyToUtc(input.startDate);
  }
  if (input.endDate !== undefined) {
    existing.endDate = dateOnlyToUtc(input.endDate);
  }
  if (toDateOnly(existing.endDate) < toDateOnly(existing.startDate)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'End date must be on or after the start date.');
  }

  await existing.save();
  const profiles = await loadUserSummaries(participantIds(existing));
  return toTripResponseWithCover(existing, profiles);
}

export async function deleteTrip(ownerId: string, id: string): Promise<void> {
  const existing = await findAuthorizedTrip(ownerId, id);
  assertOwner(existing, ownerId);
  const removed = await TripModel.deleteOne({ _id: existing._id, ownerId });
  if (removed.deletedCount === 0) {
    throw new AppError(403, 'FORBIDDEN', 'Only the trip creator can change this trip.');
  }
  await deleteInvitationsForTrip(existing._id);
  await deleteActivitiesForTrip(existing._id);
  await deleteExpensesForTrip(existing._id);
  const { deleteMemoriesForTrip } = await import('../memories/memory.service');
  await deleteMemoriesForTrip(existing._id);
  const { deleteBookingsForTrip } = await import('../bookings/booking.service');
  await deleteBookingsForTrip(existing._id);
  await tryDeleteStoredObject(existing.coverObjectKey ?? null);
}

export async function requireTripMember(userId: string, tripId: string) {
  return findAuthorizedTrip(userId, tripId);
}

async function findAuthorizedTrip(ownerId: string, id: string) {
  assertDatabaseConnected();
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }

  const trip = await TripModel.findById(id);
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }

  const isOwner = trip.ownerId?.toString() === ownerId;
  const isMember = (trip.members ?? []).some((member) => member.userId.toString() === ownerId);
  if (!isOwner && !isMember) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this trip.');
  }

  return trip;
}

function assertOwner(trip: { ownerId?: { toString(): string } | null }, ownerId: string): void {
  if (trip.ownerId?.toString() !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the trip creator can change this trip.');
  }
}

async function toTripResponseWithCover(
  record: TripRecord,
  profiles: Awaited<ReturnType<typeof loadUserSummaries>>,
): Promise<TripResponse> {
  const coverImageUrl = await resolveCoverImageUrl(record);
  return { ...toTripResponse(record, profiles), coverImageUrl };
}

function assertDatabaseConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The database is unavailable. Try again in a moment.',
    );
  }
}

export type { TripRecord };
