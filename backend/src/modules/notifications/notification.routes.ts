import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { currentUserId, requireAuth } from '../../middleware/requireAuth';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import { listNotificationsQuerySchema } from './notification.schema';
import type { ListNotificationsQuery } from './notification.schema';
import {
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification.service';

function paramId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.validated?.query as ListNotificationsQuery;
    sendSuccess(res, await listNotificationsForUser(currentUserId(req), query));
  }),
);

notificationRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { count: await getUnreadNotificationCount(currentUserId(req)) });
  }),
);

notificationRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await markAllNotificationsRead(currentUserId(req)));
  }),
);

notificationRouter.patch(
  '/:notificationId/read',
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await markNotificationRead(currentUserId(req), paramId(req.params.notificationId)),
    );
  }),
);
