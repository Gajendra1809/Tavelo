export type TripMemberResponse = {
  userId: string;
  role: 'owner' | 'member';
  name: string;
};

export type TripResponse = {
  id: string;
  name: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImageUrl: string | null;
  creatorId: string | null;
  creator: { id: string; name: string } | null;
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
  startDate: Date;
  endDate: Date;
  description?: string;
  coverImageUrl?: string | null;
  ownerId?: { toString(): string } | null;
  members?: TripMemberRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export function toTripResponse(
  record: TripRecord,
  names: ReadonlyMap<string, string> = new Map(),
): TripResponse {
  const creatorId = record.ownerId?.toString() ?? null;
  const members = memberRecords(record).map((member) => {
    const userId = member.userId.toString();
    return {
      userId,
      role: member.role === 'owner' ? 'owner' : 'member',
      name: names.get(userId) ?? 'Traveler',
    } satisfies TripMemberResponse;
  });

  return {
    id: record._id.toString(),
    name: record.name,
    title: record.name,
    destination: record.destination,
    startDate: toDateOnly(record.startDate),
    endDate: toDateOnly(record.endDate),
    description: record.description ?? '',
    coverImageUrl: record.coverImageUrl ? record.coverImageUrl : null,
    creatorId,
    creator: creatorId ? { id: creatorId, name: names.get(creatorId) ?? 'Traveler' } : null,
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
