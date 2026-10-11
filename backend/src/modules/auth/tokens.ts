import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env';
import { AppError } from '../../utils/AppError';

const ISSUER = 'tavelo';

export function signAccessToken(userId: string): { token: string; expiresIn: number } {
  const env = getEnv();
  const expiresIn = env.ACCESS_TOKEN_TTL_SECONDS;
  const token = jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn,
    issuer: ISSUER,
    jwtid: randomUUID(),
  });
  return { token, expiresIn };
}

export function readAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, getEnv().JWT_ACCESS_SECRET, { issuer: ISSUER });
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Access token is missing a subject.');
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Your session is no longer valid. Sign in again.');
  }
}

export function createRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + getEnv().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash: hashRefreshToken(raw), expiresAt };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
