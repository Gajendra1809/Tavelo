import { toPlaceResponse, type TaveloPlaceResponse } from '../places/place.mapper';
import type { PlaceDocument } from '../places/place.model';

export type TripMemberResponse = {
  userId: string;
  role: 'owner' | 'member';
  name: string;
  avatarUrl: string | null;
};

export type TripResponse = {
  id: string;
  name: string;
  title: string;
  destination: string;
  destinationPlace: TaveloPlaceResponse | null;
  startDate: string;
  endDate: string;
  description: string;
  coverImageUrl: string | null;
  creatorId: string | null;
  creator: { id: string; name: string; avatarUrl: string | null } | null;
  members: TripMemberResponse[];
  createdAt: string;
  updatedAt: string;
};

export type TripMemberRecord = {
  userId: { toString(): string };
  role?: string;
};

export type TripRecord = {
  _id: { toString(): string };
  name: string;
  destination: string;
  destinationPlace?: PlaceDocument | null;
  startDate: Date;
  endDate: Date;
  description?: string;
  coverImageUrl?: string | null;
  coverObjectKey?: string | null;
  ownerId?: { toString(): string } | null;
  members?: TripMemberRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type TripParticipantProfile = {
  name: string;
  avatarUrl: string | null;
};

export function toTripResponse(
  record: TripRecord,
  profiles: ReadonlyMap<string, TripParticipantProfile> = new Map(),
): TripResponse {
  const creatorId = record.ownerId?.toString() ?? null;
  const members = memberRecords(record).map((member) => {
    const userId = member.userId.toString();
    const profile = profiles.get(userId);
    return {
      userId,
      role: member.role === 'owner' ? 'owner' : 'member',
      name: profile?.name ?? 'Traveler',
      avatarUrl: profile?.avatarUrl ?? null,
    } satisfies TripMemberResponse;
  });

  return {
    id: record._id.toString(),
    name: record.name,
    title: record.name,
    destination: record.destination,
    destinationPlace: toPlaceResponse(record.destinationPlace),
    startDate: toDateOnly(record.startDate),
    endDate: toDateOnly(record.endDate),
    description: record.description ?? '',
    coverImageUrl: record.coverImageUrl ? record.coverImageUrl : null,
    creatorId,
    creator: creatorId
      ? {
          id: creatorId,
          name: profiles.get(creatorId)?.name ?? 'Traveler',
          avatarUrl: profiles.get(creatorId)?.avatarUrl ?? null,
        }
      : null,
    members,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function participantIds(record: TripRecord): string[] {
  const ids = memberRecords(record).map((member) => member.userId.toString());
  if (record.ownerId) {
    ids.push(record.ownerId.toString());
  }
  return ids;
}

export function dateOnlyToUtc(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function memberRecords(record: TripRecord): TripMemberRecord[] {
  const fromDb = record.members?.length ? [...record.members] : [];
  if (record.ownerId) {
    const ownerId = record.ownerId.toString();
    const ownerListed = fromDb.some((member) => member.userId.toString() === ownerId);
    if (!ownerListed) {
      fromDb.unshift({ userId: record.ownerId, role: 'owner' });
    }
  }
  if (fromDb.length === 0) {
    return [];
  }
  return fromDb.sort((left, right) => {
    const leftOwner = left.role === 'owner' ? 0 : 1;
    const rightOwner = right.role === 'owner' ? 0 : 1;
    if (leftOwner !== rightOwner) {
      return leftOwner - rightOwner;
    }
    return left.userId.toString().localeCompare(right.userId.toString());
  });
}
