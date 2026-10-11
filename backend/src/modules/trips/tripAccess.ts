import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { TripModel, type TripDocument } from './trip.model';

export type { TripDocument };

export async function assertOwnerTrip(ownerId: string, tripId: string): Promise<TripDocument> {
  if (!mongoose.isValidObjectId(tripId)) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }
  const trip = await TripModel.findById(tripId);
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }
  if (trip.ownerId?.toString() !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the trip creator can change this trip.');
  }
  return trip;
}
