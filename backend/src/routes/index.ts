import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { healthRouter } from '../modules/health/health.routes';
import { invitationRouter } from '../modules/invitations/invitation.routes';
import { tripRouter } from '../modules/trips/trip.routes';

export function createApiRouter(): Router {
  const router = Router();
  router.use(healthRouter);
  router.use('/auth', authRouter);
  router.use('/trips', tripRouter);
  router.use('/invitations', invitationRouter);
  return router;
}
