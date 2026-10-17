import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { currentUserId, requireAuth } from '../../middleware/requireAuth';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import { uploadCompleteSchema, uploadIntentSchema } from '../storage/storage.schema';
import type { UploadCompleteInput, UploadIntentInput } from '../storage/storage.schema';
import { searchUsers } from './userSearch.service';
import {
  setUsernameSchema,
  updateProfileSchema,
  userSearchQuerySchema,
  type SetUsernameInput,
  type UpdateProfileInput,
  type UserSearchQuery,
} from './user.schema';
import { checkUsernameAvailability, setUsernameForUser } from './username.service';
import {
  completeAvatarUpload,
  createAvatarUploadIntent,
  deleteAvatar,
  getCurrentUser,
  updateProfileForUser,
} from './user.service';
import { usernameAvailabilityQuerySchema, type UsernameAvailabilityQuery } from '../auth/auth.schema';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get(
  '/search',
  validate({ query: userSearchQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.validated?.query as UserSearchQuery;
    sendSuccess(res, await searchUsers(currentUserId(req), query.q, query.limit));
  }),
);

userRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await getCurrentUser(currentUserId(req)));
  }),
);

userRouter.patch(
  '/me',
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await updateProfileForUser(currentUserId(req), req.validated?.body as UpdateProfileInput));
  }),
);

userRouter.get(
  '/me/username-available',
  validate({ query: usernameAvailabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.validated?.query as UsernameAvailabilityQuery;
    sendSuccess(res, await checkUsernameAvailability(query.username, currentUserId(req)));
  }),
);

userRouter.post(
  '/me/username',
  validate({ body: setUsernameSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await setUsernameForUser(currentUserId(req), (req.validated?.body as SetUsernameInput).username),
    );
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
