import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { UserModel } from '../auth/user.model';
import { normalizeUsername, validateUsernameFormat } from './username';
import { publicUserFromDocument } from './user.service';
import type { PublicUser } from '../../types/publicUser';

export type UsernameAvailability = {
  username: string;
  available: boolean;
  reason: 'available' | 'taken' | 'invalid';
  message: string;
};

export async function checkUsernameAvailability(
  raw: string,
  excludeUserId?: string,
): Promise<UsernameAvailability> {
  const username = normalizeUsername(raw);
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return {
      username,
      available: false,
      reason: 'invalid',
      message: formatError,
    };
  }

  const existing = await UserModel.findOne({ username }).select('_id');
  if (existing && (!excludeUserId || existing._id.toString() !== excludeUserId)) {
    return {
      username,
      available: false,
      reason: 'taken',
      message: 'Username already taken.',
    };
  }

  return {
    username,
    available: true,
    reason: 'available',
    message: 'Username available.',
  };
}

export async function setUsernameForUser(userId: string, raw: string): Promise<PublicUser> {
  const username = normalizeUsername(raw);
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    throw new AppError(400, 'VALIDATION_ERROR', formatError);
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }
  if (user.username === username) {
    return publicUserFromDocument(user);
  }

  const taken = await UserModel.exists({ username, _id: { $ne: userId } });
  if (taken) {
    throw new AppError(409, 'USERNAME_IN_USE', 'Username already taken.');
  }

  try {
    user.username = username;
    await user.save();
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(409, 'USERNAME_IN_USE', 'Username already taken.');
    }
    throw error;
  }

  return publicUserFromDocument(user);
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
