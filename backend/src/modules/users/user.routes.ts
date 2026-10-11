import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { currentUserId, requireAuth } from '../../middleware/requireAuth';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import { uploadCompleteSchema, uploadIntentSchema } from '../storage/storage.schema';
import type { UploadCompleteInput, UploadIntentInput } from '../storage/storage.schema';
import {
  completeAvatarUpload,
  createAvatarUploadIntent,
  deleteAvatar,
  getCurrentUser,
} from './user.service';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getCurrentUser(currentUserId(req)));
  }),
);

userRouter.post(
  '/me/avatar/upload-intent',
  validate({ body: uploadIntentSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await createAvatarUploadIntent(
        currentUserId(req),
        req.validated?.body as UploadIntentInput,
      ),
      201,
    );
  }),
);

userRouter.post(
  '/me/avatar/complete',
  validate({ body: uploadCompleteSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await completeAvatarUpload(currentUserId(req), req.validated?.body as UploadCompleteInput),
    );
  }),
);

userRouter.delete(
  '/me/avatar',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await deleteAvatar(currentUserId(req)));
  }),
);
