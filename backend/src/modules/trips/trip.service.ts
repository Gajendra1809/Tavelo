import mongoose from 'mongoose';
import { UserModel } from '../auth/user.model';
import { deleteActivitiesForTrip } from '../itinerary/activity.service';
import { deleteExpensesForTrip } from '../expenses/expense.service';
import { deleteInvitationsForTrip } from '../invitations/invitation.service';
import { AppError } from '../../utils/AppError';
import {
  dateOnlyToUtc,
  participantIds,
  toDateOnly,
  toTripResponse,
  type TripRecord,
  type TripResponse,
} from './trip.mapper';
import { TripModel } from './trip.model';
import type { CreateTripInput, UpdateTripInput } from './trip.schema';

export async function listTrips(ownerId: string): Promise<TripResponse[]> {
  assertDatabaseConnected();
  const trips = await TripModel.find({
    $or: [{ ownerId }, { 'members.userId': ownerId }],
  })
    .sort({ startDate: 1, createdAt: 1 })
    .lean();
  const names = await loadNames(trips.flatMap((trip) => participantIds(trip)));
  return trips.map((trip) => toTripResponse(trip, names));
}

export async function getTrip(ownerId: string, id: string): Promise<TripResponse> {
  const trip = await findAuthorizedTrip(ownerId, id);
  const names = await loadNames(participantIds(trip));
  return toTripResponse(trip, names);
}

export async function createTrip(ownerId: string, input: CreateTripInput): Promise<TripResponse> {
  assertDatabaseConnected();
  const trip = await TripModel.create({
    name: input.name,
    destination: input.destination,
    startDate: dateOnlyToUtc(input.startDate),
    endDate: dateOnlyToUtc(input.endDate),
    description: input.description,
    coverImageUrl: input.coverImageUrl ? input.coverImageUrl : null,
    ownerId,
    members: [{ userId: ownerId, role: 'owner' }],
  });
  const names = await loadNames([ownerId]);
  return toTripResponse(trip, names);
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
  if (input.coverImageUrl !== undefined) {
    existing.coverImageUrl = input.coverImageUrl ? input.coverImageUrl : null;
  }

  if (toDateOnly(existing.endDate) < toDateOnly(existing.startDate)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'End date must be on or after the start date.');
  }

  await existing.save();
  const names = await loadNames(participantIds(existing));
  return toTripResponse(existing, names);
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

async function loadNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => mongoose.isValidObjectId(id)))];
  if (unique.length === 0) {
    return new Map();
  }

  const users = await UserModel.find({ _id: { $in: unique } })
    .select('name')
    .lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
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
