import mongoose from 'mongoose';
import { UserModel } from '../auth/user.model';
import { requireTripMember } from '../trips/trip.service';
import { dateOnlyToUtc, toDateOnly } from '../trips/trip.mapper';
import { AppError } from '../../utils/AppError';
import { ItineraryActivityModel } from './activity.model';
import type { CreateActivityInput, ListActivitiesQuery, UpdateActivityInput } from './activity.schema';

export type ActivityResponse = {
  id: string;
  tripId: string;
  title: string;
  location: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export async function listActivities(
  userId: string,
  tripId: string,
  query: ListActivitiesQuery,
): Promise<ActivityResponse[]> {
  const trip = await requireTripMember(userId, tripId);
  const filter: { tripId: mongoose.Types.ObjectId; date?: Date } = { tripId: trip._id };
  if (query.date) {
    assertDateWithinTrip(trip, query.date);
    filter.date = dateOnlyToUtc(query.date);
  }

  const activities = await ItineraryActivityModel.find(filter).lean();
  activities.sort(compareActivities);
  const names = await loadCreatorNames(activities.map((activity) => activity.createdBy.toString()));
  return activities.map((activity) => toActivityResponse(activity, names));
}

export async function getActivity(
  userId: string,
  tripId: string,
  activityId: string,
): Promise<ActivityResponse> {
  const activity = await findTripActivity(userId, tripId, activityId);
  const names = await loadCreatorNames([activity.createdBy.toString()]);
  return toActivityResponse(activity, names);
}

export async function createActivity(
  userId: string,
  tripId: string,
  input: CreateActivityInput,
): Promise<ActivityResponse> {
  const trip = await requireTripMember(userId, tripId);
  assertDateWithinTrip(trip, input.date);

  const activity = await ItineraryActivityModel.create({
    tripId: trip._id,
    title: input.title,
    location: input.location ?? null,
    date: dateOnlyToUtc(input.date),
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    notes: input.notes ?? '',
    createdBy: userId,
  });

  const names = await loadCreatorNames([userId]);
  return toActivityResponse(activity, names);
}

export async function updateActivity(
  userId: string,
  tripId: string,
  activityId: string,
  input: UpdateActivityInput,
): Promise<ActivityResponse> {
  const trip = await requireTripMember(userId, tripId);
  const activity = await findActivityDocument(tripId, activityId);

  if (input.title !== undefined) {
    activity.title = input.title;
  }
  if (input.location !== undefined) {
    activity.location = input.location;
  }
  if (input.date !== undefined) {
    assertDateWithinTrip(trip, input.date);
    activity.date = dateOnlyToUtc(input.date);
  }
  if (input.startTime !== undefined) {
    activity.startTime = input.startTime;
  }
  if (input.endTime !== undefined) {
    activity.endTime = input.endTime;
  }
  if (input.notes !== undefined) {
    activity.notes = input.notes;
  }

  assertTimeRange(activity.startTime, activity.endTime);
  await activity.save();

  const names = await loadCreatorNames([activity.createdBy.toString()]);
  return toActivityResponse(activity, names);
}

export async function deleteActivity(userId: string, tripId: string, activityId: string): Promise<void> {
  await requireTripMember(userId, tripId);
  const activity = await findActivityDocument(tripId, activityId);
  await activity.deleteOne();
}

export async function deleteActivitiesForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  await ItineraryActivityModel.deleteMany({ tripId });
}

async function findTripActivity(userId: string, tripId: string, activityId: string) {
  await requireTripMember(userId, tripId);
  return findActivityDocument(tripId, activityId);
}

async function findActivityDocument(tripId: string, activityId: string) {
  if (!mongoose.isValidObjectId(activityId)) {
    throw new AppError(404, 'NOT_FOUND', 'Activity not found.');
  }
  const activity = await ItineraryActivityModel.findById(activityId);
  if (!activity || activity.tripId.toString() !== tripId) {
    throw new AppError(404, 'NOT_FOUND', 'Activity not found.');
  }
  return activity;
}

function assertDateWithinTrip(
  trip: { startDate: Date; endDate: Date },
  date: string,
): void {
  const start = toDateOnly(trip.startDate);
  const end = toDateOnly(trip.endDate);
  if (date < start || date > end) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Activity date must fall within the trip dates.',
    );
  }
}

function assertTimeRange(start: string | null | undefined, end: string | null | undefined): void {
  if (start && end && end < start) {
    throw new AppError(400, 'VALIDATION_ERROR', 'End time must be on or after the start time.');
  }
}

function compareActivities(
  left: { date: Date; startTime?: string | null; title: string; createdAt: Date },
  right: { date: Date; startTime?: string | null; title: string; createdAt: Date },
): number {
  const leftDate = toDateOnly(left.date);
  const rightDate = toDateOnly(right.date);
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }
  const leftTime = left.startTime ?? '99:99';
  const rightTime = right.startTime ?? '99:99';
  if (leftTime !== rightTime) {
    return leftTime.localeCompare(rightTime);
  }
  const titleCompare = left.title.localeCompare(right.title);
  if (titleCompare !== 0) {
    return titleCompare;
  }
  return left.createdAt.getTime() - right.createdAt.getTime();
}

function toActivityResponse(
  activity: {
    _id: { toString(): string };
    tripId: { toString(): string };
    title: string;
    location?: string | null;
    date: Date;
    startTime?: string | null;
    endTime?: string | null;
    notes?: string;
    createdBy: { toString(): string };
    createdAt: Date;
    updatedAt: Date;
  },
  names: ReadonlyMap<string, string>,
): ActivityResponse {
  const creatorId = activity.createdBy.toString();
  return {
    id: activity._id.toString(),
    tripId: activity.tripId.toString(),
    title: activity.title,
    location: activity.location ?? null,
    date: toDateOnly(activity.date),
    startTime: activity.startTime ?? null,
    endTime: activity.endTime ?? null,
    notes: activity.notes ?? '',
    createdBy: { id: creatorId, name: names.get(creatorId) ?? 'Traveler' },
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

async function loadCreatorNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => mongoose.isValidObjectId(id)))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await UserModel.find({ _id: { $in: unique } }).select('name').lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}
