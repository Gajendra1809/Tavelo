import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env';
import { sendError } from '../utils/apiResponse';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: getEnv().NODE_ENV === 'test' ? 1_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Too many attempts. Try again later.');
  },
});
