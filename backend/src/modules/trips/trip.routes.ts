import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { currentUserId, requireAuth } from '../../middleware/requireAuth';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import {
  createTripSchema,
  updateTripSchema,
  type CreateTripInput,
  type UpdateTripInput,
} from './trip.schema';
import {
  cancelInvitation,
  inviteToTrip,
  listSentInvitations,
  removeMember,
} from '../invitations/invitation.service';
import { inviteSchema, type InviteInput } from '../invitations/invitation.schema';
import {
  createActivitySchema,
  listActivitiesQuerySchema,
  updateActivitySchema,
  type CreateActivityInput,
  type ListActivitiesQuery,
  type UpdateActivityInput,
} from '../itinerary/activity.schema';
import {
  createExpenseSchema,
  createSettlementSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type CreateSettlementInput,
  type UpdateExpenseInput,
} from '../expenses/expense.schema';
import {
  cancelSettlement,
  createExpense,
  deleteExpense,
  getBalances,
  getExpense,
  getSettlementSuggestions,
  listExpenses,
  listSettlements,
  recordSettlement,
  updateExpense,
} from '../expenses/expense.service';
import {
  createActivity,
  deleteActivity,
  getActivity,
  listActivities,
  updateActivity,
} from '../itinerary/activity.service';
import { createTrip, deleteTrip, getTrip, listTrips, updateTrip } from './trip.service';

export const tripRouter = Router();

// Every trip route uses the verified access token. The owner id is never taken from the body.
tripRouter.use(requireAuth);

tripRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { trips: await listTrips(currentUserId(req)) });
  }),
);

tripRouter.post(
  '/',
  validate({ body: createTripSchema }),
  asyncHandler(async (req, res) => {
    const trip = await createTrip(currentUserId(req), req.validated?.body as CreateTripInput);
    sendSuccess(res, trip, 201);
  }),
);

tripRouter.post(
  '/:id/invitations',
  validate({ body: inviteSchema }),
  asyncHandler(async (req, res) => {
    const invitation = await inviteToTrip(
      currentUserId(req),
      paramId(req.params.id),
      req.validated?.body as InviteInput,
    );
    sendSuccess(res, invitation, 201);
  }),
);

tripRouter.get(
  '/:id/invitations',
  asyncHandler(async (req, res) => {
    sendSuccess(res, {
      invitations: await listSentInvitations(currentUserId(req), paramId(req.params.id)),
    });
  }),
);

tripRouter.delete(
  '/:id/invitations/:invitationId',
  asyncHandler(async (req, res) => {
    await cancelInvitation(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.invitationId),
    );
    sendSuccess(res, { cancelled: true });
  }),
);

tripRouter.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    await removeMember(currentUserId(req), paramId(req.params.id), paramId(req.params.userId));
    sendSuccess(res, { removed: true });
  }),
);

tripRouter.get(
  '/:id/activities',
  validate({ query: listActivitiesQuerySchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, {
      activities: await listActivities(
        currentUserId(req),
        paramId(req.params.id),
        (req.validated?.query ?? {}) as ListActivitiesQuery,
      ),
    });
  }),
);

tripRouter.post(
  '/:id/activities',
  validate({ body: createActivitySchema }),
  asyncHandler(async (req, res) => {
    const activity = await createActivity(
      currentUserId(req),
      paramId(req.params.id),
      req.validated?.body as CreateActivityInput,
    );
    sendSuccess(res, activity, 201);
  }),
);

tripRouter.get(
  '/:id/activities/:activityId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getActivity(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.activityId),
    ));
  }),
);

tripRouter.patch(
  '/:id/activities/:activityId',
  validate({ body: updateActivitySchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await updateActivity(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.activityId),
      req.validated?.body as UpdateActivityInput,
    ));
  }),
);

tripRouter.delete(
  '/:id/activities/:activityId',
  asyncHandler(async (req, res) => {
    await deleteActivity(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.activityId),
    );
    sendSuccess(res, { deleted: true });
  }),
);

tripRouter.get(
  '/:id/expenses/balances',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getBalances(currentUserId(req), paramId(req.params.id)));
  }),
);

tripRouter.get(
  '/:id/expenses/settlement-suggestions',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getSettlementSuggestions(currentUserId(req), paramId(req.params.id)));
  }),
);

tripRouter.get(
  '/:id/settlements',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { settlements: await listSettlements(currentUserId(req), paramId(req.params.id)) });
  }),
);

tripRouter.post(
  '/:id/settlements',
  validate({ body: createSettlementSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await recordSettlement(
        currentUserId(req),
        paramId(req.params.id),
        req.validated?.body as CreateSettlementInput,
      ),
      201,
    );
  }),
);

tripRouter.delete(
  '/:id/settlements/:settlementId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await cancelSettlement(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.settlementId),
    ));
  }),
);

tripRouter.get(
  '/:id/expenses',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { expenses: await listExpenses(currentUserId(req), paramId(req.params.id)) });
  }),
);

tripRouter.post(
  '/:id/expenses',
  validate({ body: createExpenseSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await createExpense(
        currentUserId(req),
        paramId(req.params.id),
        req.validated?.body as CreateExpenseInput,
      ),
      201,
    );
  }),
);

tripRouter.get(
  '/:id/expenses/:expenseId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getExpense(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.expenseId),
    ));
  }),
);

tripRouter.patch(
  '/:id/expenses/:expenseId',
  validate({ body: updateExpenseSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await updateExpense(
      currentUserId(req),
      paramId(req.params.id),
      paramId(req.params.expenseId),
      req.validated?.body as UpdateExpenseInput,
    ));
  }),
);

tripRouter.delete(
  '/:id/expenses/:expenseId',
  asyncHandler(async (req, res) => {
    await deleteExpense(currentUserId(req), paramId(req.params.id), paramId(req.params.expenseId));
    sendSuccess(res, { deleted: true });
  }),
);

tripRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getTrip(currentUserId(req), paramId(req.params.id)));
  }),
);

tripRouter.patch(
  '/:id',
  validate({ body: updateTripSchema }),
  asyncHandler(async (req, res) => {
    const trip = await updateTrip(
      currentUserId(req),
      paramId(req.params.id),
      req.validated?.body as UpdateTripInput,
    );
    sendSuccess(res, trip);
  }),
);

tripRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteTrip(currentUserId(req), paramId(req.params.id));
    sendSuccess(res, { deleted: true });
  }),
);

function paramId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value;
}
