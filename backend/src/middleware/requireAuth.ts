import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { readAccessToken } from '../modules/auth/tokens';
import { AppError } from '../utils/AppError';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match?.[1]) {
    next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'));
    return;
  }

  try {
    const userId = readAccessToken(match[1]);
    if (!mongoose.isValidObjectId(userId)) {
      next(new AppError(401, 'UNAUTHORIZED', 'Your session is no longer valid. Sign in again.'));
      return;
    }
    req.auth = { userId };
    next();
  } catch (error) {
    next(error);
  }
}

export function currentUserId(req: Request): string {
  if (!req.auth?.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  return req.auth.userId;
}
