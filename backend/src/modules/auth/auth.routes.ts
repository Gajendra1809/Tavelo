import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { authRateLimit } from '../../middleware/authRateLimit';
import { sendSuccess } from '../../utils/apiResponse';
import { validate } from '../../utils/validate';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  usernameAvailabilityQuerySchema,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type UsernameAvailabilityQuery,
} from './auth.schema';
import { loginUser, logoutSession, refreshSession, registerUser } from './auth.service';
import { checkUsernameAvailability } from '../users/username.service';

export const authRouter = Router();

authRouter.use(authRateLimit);

authRouter.get(
  '/username-available',
  validate({ query: usernameAvailabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.validated?.query as UsernameAvailabilityQuery;
    sendSuccess(res, await checkUsernameAvailability(query.username));
  }),
);

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await registerUser(req.validated?.body as RegisterInput), 201);
  }),
);

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await loginUser(req.validated?.body as LoginInput));
  }),
);

authRouter.post(
  '/refresh',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await refreshSession(req.validated?.body as RefreshInput));
  }),
);

authRouter.post(
  '/logout',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    await logoutSession(req.validated?.body as RefreshInput);
    sendSuccess(res, { loggedOut: true });
  }),
);
