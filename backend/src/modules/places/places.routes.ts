import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/requireAuth';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import { searchPlacesForApi } from './placeSearch.service';
import { placeSearchQuerySchema, type PlaceSearchQuery } from './place.schema';

export const placesRouter = Router();

placesRouter.use(requireAuth);

placesRouter.get(
  '/search',
  validate({ query: placeSearchQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.validated?.query as PlaceSearchQuery;
    const results = await searchPlacesForApi(query.q, query.limit);
    sendSuccess(res, { results, attribution: '© OpenStreetMap contributors' });
  }),
);
