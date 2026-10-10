import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { tripRouter } from '../modules/trips/trip.routes';

export function createApiRouter(): Router {
  const router = Router();
  router.use(healthRouter);
  router.use('/trips', tripRouter);
  return router;
}
