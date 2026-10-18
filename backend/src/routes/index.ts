import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { healthRouter } from '../modules/health/health.routes';
import { invitationRouter } from '../modules/invitations/invitation.routes';
import { notificationRouter } from '../modules/notifications/notification.routes';
import { placesRouter } from '../modules/places/places.routes';
import { tripRouter } from '../modules/trips/trip.routes';
import { userRouter } from '../modules/users/user.routes';

export function createApiRouter(): Router {
  const router = Router();
  router.use(healthRouter);
  router.use('/auth', authRouter);
  router.use('/users', userRouter);
  router.use('/places', placesRouter);
  router.use('/trips', tripRouter);
  router.use('/invitations', invitationRouter);
  router.use('/notifications', notificationRouter);
  return router;
}
