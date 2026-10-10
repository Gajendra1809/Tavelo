export type TripResponse = {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TripRecord = {
  _id: { toString(): string };
  name: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toTripResponse(record: TripRecord): TripResponse {
  return {
    id: record._id.toString(),
    name: record.name,
    destination: record.destination,
    startDate: toDateOnly(record.startDate),
    endDate: toDateOnly(record.endDate),
    description: record.description ?? '',
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function dateOnlyToUtc(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
