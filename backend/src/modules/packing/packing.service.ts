import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { loadUserSummaries } from '../users/user.service';
import { participantIds } from '../trips/trip.mapper';
import { requireTripMember } from '../trips/trip.service';
import { PackingItemModel, type PackingItemDocument } from './packing.model';
import type {
  CreateGroupPackingInput,
  CreatePersonalPackingInput,
  UpdateGroupPackingInput,
  UpdatePersonalPackingInput,
} from './packing.schema';

export type PackingPerson = { id: string; name: string };

export type GroupPackingItemResponse = {
  id: string;
  tripId: string;
  name: string;
  packed: boolean;
  owner: PackingPerson | null;
  createdBy: PackingPerson;
  createdAt: string;
  updatedAt: string;
};

export type PersonalPackingItemResponse = {
  id: string;
  tripId: string;
  name: string;
  packed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PackingListResponse<T> = {
  items: T[];
  packedCount: number;
  total: number;
};

const MAX_ITEMS_PER_LIST = 100;

function withProgress<T extends { packed: boolean }>(items: T[]): PackingListResponse<T> {
  return {
    items,
    packedCount: items.filter((item) => item.packed).length,
    total: items.length,
  };
}

export async function listGroupPacking(
  userId: string,
  tripId: string,
): Promise<PackingListResponse<GroupPackingItemResponse>> {
  const trip = await requireTripMember(userId, tripId);
  const items = await PackingItemModel.find({ tripId: trip._id, kind: 'group' })
    .sort({ createdAt: 1 })
    .lean();
  const names = await loadUserSummaries(
    items.flatMap((item) => [
      item.createdBy.toString(),
      ...(item.ownerId ? [item.ownerId.toString()] : []),
    ]),
  );
  return withProgress(items.map((item) => toGroupResponse(item, names, tripMemberIds(trip))));
}

export async function createGroupPacking(
  userId: string,
  tripId: string,
  input: CreateGroupPackingInput,
): Promise<GroupPackingItemResponse> {
  const trip = await requireTripMember(userId, tripId);
  await assertListHasRoom(trip._id, 'group');
  const members = tripMemberIds(trip);
  const ownerId = resolveOwnerId(input.ownerId, members);
  const item = await PackingItemModel.create({
    tripId: trip._id,
    kind: 'group',
    name: input.name,
    packed: false,
    createdBy: userId,
    userId: null,
    ownerId,
  });
  const names = await loadUserSummaries([userId, ...(ownerId ? [ownerId] : [])]);
  return toGroupResponse(item, names, members);
}

export async function updateGroupPacking(
  userId: string,
  tripId: string,
  itemId: string,
  input: UpdateGroupPackingInput,
): Promise<GroupPackingItemResponse> {
  const trip = await requireTripMember(userId, tripId);
  const members = tripMemberIds(trip);
  const item = await findGroupItem(trip._id, itemId);
  if (input.name !== undefined) {
    item.name = input.name;
  }
  if (input.packed !== undefined) {
    item.packed = input.packed;
  }
  if (input.ownerId !== undefined) {
    const nextOwnerId = resolveOwnerId(input.ownerId, members);
    item.ownerId = nextOwnerId ? new mongoose.Types.ObjectId(nextOwnerId) : null;
  }
  await item.save();
  const names = await loadUserSummaries([
    item.createdBy.toString(),
    ...(item.ownerId ? [item.ownerId.toString()] : []),
  ]);
  return toGroupResponse(item, names, members);
}

export async function deleteGroupPacking(userId: string, tripId: string, itemId: string): Promise<void> {
  const trip = await requireTripMember(userId, tripId);
  const item = await findGroupItem(trip._id, itemId);
  await item.deleteOne();
}

export async function listPersonalPacking(
  userId: string,
  tripId: string,
): Promise<PackingListResponse<PersonalPackingItemResponse>> {
  const trip = await requireTripMember(userId, tripId);
  const items = await PackingItemModel.find({
    tripId: trip._id,
    kind: 'personal',
    userId,
  })
    .sort({ createdAt: 1 })
    .lean();
  return withProgress(items.map(toPersonalResponse));
}

export async function createPersonalPacking(
  userId: string,
  tripId: string,
  input: CreatePersonalPackingInput,
): Promise<PersonalPackingItemResponse> {
  const trip = await requireTripMember(userId, tripId);
  await assertListHasRoom(trip._id, 'personal', userId);
  const item = await PackingItemModel.create({
    tripId: trip._id,
    kind: 'personal',
    name: input.name,
    packed: false,
    createdBy: userId,
    userId,
    ownerId: null,
  });
  return toPersonalResponse(item);
}

export async function updatePersonalPacking(
  userId: string,
  tripId: string,
  itemId: string,
  input: UpdatePersonalPackingInput,
): Promise<PersonalPackingItemResponse> {
  const item = await findPersonalItem(userId, tripId, itemId);
  if (input.name !== undefined) {
    item.name = input.name;
  }
  if (input.packed !== undefined) {
    item.packed = input.packed;
  }
  await item.save();
  return toPersonalResponse(item);
}

export async function deletePersonalPacking(
  userId: string,
  tripId: string,
  itemId: string,
): Promise<void> {
  const item = await findPersonalItem(userId, tripId, itemId);
  await item.deleteOne();
}

export async function deletePackingForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  await PackingItemModel.deleteMany({ tripId });
}

/** Personal lists are deleted; group assignments to the removed member are cleared. */
export async function clearPackingForRemovedMember(
  tripId: mongoose.Types.ObjectId,
  memberId: string,
): Promise<void> {
  if (!mongoose.isValidObjectId(memberId)) {
    return;
  }
  const memberObjectId = new mongoose.Types.ObjectId(memberId);
  await PackingItemModel.deleteMany({ tripId, kind: 'personal', userId: memberObjectId });
  await PackingItemModel.updateMany(
    { tripId, kind: 'group', ownerId: memberObjectId },
    { $set: { ownerId: null } },
  );
}

async function findGroupItem(tripId: mongoose.Types.ObjectId, itemId: string): Promise<PackingItemDocument> {
  if (!mongoose.isValidObjectId(itemId)) {
    throw new AppError(404, 'NOT_FOUND', 'Item not found.');
  }
  const item = await PackingItemModel.findById(itemId);
  if (!item || item.tripId.toString() !== tripId.toString() || item.kind !== 'group') {
    throw new AppError(404, 'NOT_FOUND', 'Item not found.');
  }
  return item;
}

async function findPersonalItem(
  userId: string,
  tripId: string,
  itemId: string,
): Promise<PackingItemDocument> {
  const trip = await requireTripMember(userId, tripId);
  if (!mongoose.isValidObjectId(itemId)) {
    throw new AppError(404, 'NOT_FOUND', 'Item not found.');
  }
  const item = await PackingItemModel.findById(itemId);
  if (
    !item ||
    item.tripId.toString() !== trip._id.toString() ||
    item.kind !== 'personal' ||
    item.userId?.toString() !== userId
  ) {
    throw new AppError(404, 'NOT_FOUND', 'Item not found.');
  }
  return item;
}

async function assertListHasRoom(
  tripId: mongoose.Types.ObjectId,
  kind: 'group' | 'personal',
  userId?: string,
): Promise<void> {
  const filter =
    kind === 'personal' && userId
      ? { tripId, kind, userId }
      : { tripId, kind };
  const total = await PackingItemModel.countDocuments(filter);
  if (total >= MAX_ITEMS_PER_LIST) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This packing list is full.');
  }
}

function tripMemberIds(trip: Parameters<typeof participantIds>[0]): Set<string> {
  return new Set(participantIds(trip));
}

function resolveOwnerId(ownerId: string | null | undefined, members: Set<string>): string | null {
  if (ownerId === undefined || ownerId === null || ownerId === '') {
    return null;
  }
  if (!members.has(ownerId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'That person is not on this trip.');
  }
  return ownerId;
}

function toGroupResponse(
  item: {
    _id: { toString(): string };
    tripId: { toString(): string };
    name: string;
    packed: boolean;
    ownerId?: { toString(): string } | null;
    createdBy: { toString(): string };
    createdAt: Date;
    updatedAt: Date;
  },
  names: Map<string, { name: string }>,
  members: Set<string>,
): GroupPackingItemResponse {
  const ownerId = item.ownerId?.toString() ?? null;
  const ownerStillOnTrip = ownerId !== null && members.has(ownerId);
  return {
    id: item._id.toString(),
    tripId: item.tripId.toString(),
    name: item.name,
    packed: item.packed,
    owner: ownerStillOnTrip
      ? { id: ownerId, name: names.get(ownerId)?.name ?? 'Traveler' }
      : null,
    createdBy: {
      id: item.createdBy.toString(),
      name: names.get(item.createdBy.toString())?.name ?? 'Traveler',
    },
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toPersonalResponse(item: {
  _id: { toString(): string };
  tripId: { toString(): string };
  name: string;
  packed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PersonalPackingItemResponse {
  return {
    id: item._id.toString(),
    tripId: item.tripId.toString(),
    name: item.name,
    packed: item.packed,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
