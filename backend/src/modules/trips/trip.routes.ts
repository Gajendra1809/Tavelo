import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import { createTrip, getTrip, listTrips } from './trip.service';
import { createTripSchema, type CreateTripInput } from './trip.schema';

export const tripRouter = Router();

// Trips are shared with every caller until accounts exist.
// Do not store private details here. A later phase must check membership on the server.
tripRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, { trips: await listTrips() });
  }),
);

tripRouter.post(
  '/',
  validate({ body: createTripSchema }),
  asyncHandler(async (req, res) => {
    const trip = await createTrip(req.validated?.body as CreateTripInput);
    sendSuccess(res, trip, 201);
  }),
);

tripRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getTrip(paramId(req.params.id)));
  }),
);

function paramId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value;
}
