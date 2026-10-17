import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { hashPassword, verifyPassword } from './password';
import { RefreshTokenModel } from './refreshToken.model';
import type { LoginInput, RefreshInput, RegisterInput } from './auth.schema';
import { createRefreshToken, hashRefreshToken, signAccessToken } from './tokens';
import type { PublicUser } from '../../types/publicUser';
import { publicUserFromDocument } from '../users/user.service';
import { normalizeLoginIdentifier, normalizeUsername, validateUsernameFormat } from '../users/username';
import { UserModel, type UserDocument } from './user.model';

export type { PublicUser };

export type AuthSession = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

const INVALID_LOGIN = 'Email, username, or password is incorrect.';

export async function registerUser(input: RegisterInput): Promise<AuthSession> {
  assertDatabaseConnected();
  const username = normalizeUsername(input.username);
  const usernameError = validateUsernameFormat(username);
  if (usernameError) {
    throw new AppError(400, 'VALIDATION_ERROR', usernameError);
  }

  const taken = await UserModel.exists({ username });
  if (taken) {
    throw new AppError(409, 'USERNAME_IN_USE', 'Username already taken.');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      username,
      passwordHash,
    });
    return issueSession(user);
  } catch (error) {
    if (isDuplicateKey(error)) {
      const key = duplicateKeyField(error);
      if (key === 'username') {
        throw new AppError(409, 'USERNAME_IN_USE', 'Username already taken.');
      }
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<AuthSession> {
  assertDatabaseConnected();
  const user = await findUserForLogin(normalizeLoginIdentifier(input.email)).select('+passwordHash');
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_LOGIN);
  }

  return issueSession(user);
}

function findUserForLogin(identifier: string) {
  if (identifier.includes('@')) {
    return UserModel.findOne({ email: identifier });
  }
  return UserModel.findOne({ username: identifier });
}

export async function refreshSession(input: RefreshInput): Promise<AuthSession> {
  assertDatabaseConnected();
  const tokenHash = hashRefreshToken(input.refreshToken);
  const record = await RefreshTokenModel.findOne({ tokenHash });
  if (!record) {
    throw new AppError(401, 'UNAUTHORIZED', 'Your session is no longer valid. Sign in again.');
  }

  if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    await revokeAllForUser(record.userId);
    throw new AppError(401, 'UNAUTHORIZED', 'Your session is no longer valid. Sign in again.');
  }

  const user = await UserModel.findById(record.userId);
  if (!user) {
    await revokeAllForUser(record.userId);
    throw new AppError(401, 'UNAUTHORIZED', 'Your session is no longer valid. Sign in again.');
  }

  const next = createRefreshToken();
  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: next.hash,
    expiresAt: next.expiresAt,
  });
  record.revokedAt = new Date();
  record.replacedByHash = next.hash;
  await record.save();

  const access = signAccessToken(user._id.toString());
  return {
    user: await publicUserFromDocument(user),
    accessToken: access.token,
    refreshToken: next.raw,
    expiresIn: access.expiresIn,
  };
}

export async function logoutSession(input: RefreshInput): Promise<void> {
  assertDatabaseConnected();
  const record = await RefreshTokenModel.findOne({ tokenHash: hashRefreshToken(input.refreshToken) });
  if (!record || record.revokedAt) {
    return;
  }

  record.revokedAt = new Date();
  await record.save();
}

async function issueSession(user: UserDocument): Promise<AuthSession> {
  const refresh = createRefreshToken();
  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: refresh.hash,
    expiresAt: refresh.expiresAt,
  });
  const access = signAccessToken(user._id.toString());
  return {
    user: await publicUserFromDocument(user),
    accessToken: access.token,
    refreshToken: refresh.raw,
    expiresIn: access.expiresIn,
  };
}

async function revokeAllForUser(userId: mongoose.Types.ObjectId): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

function assertDatabaseConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The database is unavailable. Try again in a moment.',
    );
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function duplicateKeyField(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('keyPattern' in error)) {
    return null;
  }
  const pattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
  if (!pattern) {
    return null;
  }
  if ('username' in pattern) {
    return 'username';
  }
  if ('email' in pattern) {
    return 'email';
  }
  return null;
}
