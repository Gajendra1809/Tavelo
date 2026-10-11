import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { currentUserId, requireAuth } from '../../middleware/requireAuth';
import { sendSuccess } from '../../utils/apiResponse';
import { acceptInvitation, declineInvitation, listReceivedInvitations } from './invitation.service';

export const invitationRouter = Router();

invitationRouter.use(requireAuth);

invitationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { invitations: await listReceivedInvitations(currentUserId(req)) });
  }),
);

invitationRouter.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await acceptInvitation(currentUserId(req), paramId(req.params.id)));
  }),
);

invitationRouter.post(
  '/:id/decline',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await declineInvitation(currentUserId(req), paramId(req.params.id)));
  }),
);

function paramId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value;
}
