import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { dateOnlyToUtc, toTripResponse, type TripResponse } from './trip.mapper';
import { TripModel } from './trip.model';
import type { CreateTripInput } from './trip.schema';

export async function listTrips(): Promise<TripResponse[]> {
  assertDatabaseConnected();
  const trips = await TripModel.find().sort({ startDate: 1, createdAt: 1 }).lean();
  return trips.map((trip) => toTripResponse(trip));
}

export async function getTrip(id: string): Promise<TripResponse> {
  assertDatabaseConnected();
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }

  const trip = await TripModel.findById(id).lean();
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }

  return toTripResponse(trip);
}

export async function createTrip(input: CreateTripInput): Promise<TripResponse> {
  assertDatabaseConnected();
  const trip = await TripModel.create({
    name: input.name,
    destination: input.destination,
    startDate: dateOnlyToUtc(input.startDate),
    endDate: dateOnlyToUtc(input.endDate),
    description: input.description,
  });

  return toTripResponse(trip);
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
