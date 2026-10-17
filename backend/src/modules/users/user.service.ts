import mongoose from 'mongoose';
import { getStorageConfig } from '../../config/storageEnv';
import { AppError } from '../../utils/AppError';
import { UserModel, type UserDocument } from '../auth/user.model';
import type { PublicUser } from '../../types/publicUser';
import {
  assertObjectStorageAvailable,
  createPresignedGetUrl,
  createPresignedPutUrl,
  headStoredObject,
  tryDeleteStoredObject,
} from '../storage/objectStore';
import {
  ALLOWED_IMAGE_TYPES,
  assertAllowedContentType,
  resolveStoredContentType,
  assertAvatarObjectKey,
  buildAvatarObjectKey,
  maxBytesForKind,
} from '../storage/policy';
import type { UploadCompleteInput, UploadIntentInput } from '../storage/storage.schema';
import { normalizeUsername, validateUsernameFormat } from './username';
import type { UpdateProfileInput } from './user.schema';

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findUser(userId);
  return publicUserFromDocument(user);
}

export async function createAvatarUploadIntent(
  userId: string,
  input: UploadIntentInput,
): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> {
  assertObjectStorageAvailable();
  const config = getStorageConfig();
  try {
    assertAllowedContentType(input.contentType);
  } catch (error) {
    throw validationError(error);
  }
  const maxBytes = maxBytesForKind('avatar', config.avatarMaxBytes, config.tripCoverMaxBytes);
  if (input.byteSize > maxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This image is too large.');
  }

  const objectKey = buildAvatarObjectKey(userId, input.contentType);
  const { uploadUrl, expiresIn } = await createPresignedPutUrl(
    objectKey,
    input.contentType,
    input.byteSize,
  );
  return { objectKey, uploadUrl, expiresIn };
}

export async function completeAvatarUpload(
  userId: string,
  input: UploadCompleteInput,
): Promise<PublicUser> {
  assertObjectStorageAvailable();
  const config = getStorageConfig();
  try {
    assertAvatarObjectKey(userId, input.objectKey);
  } catch (error) {
    throw validationError(error);
  }

  const head = await headStoredObject(input.objectKey);
  const contentType = resolveStoredContentType(
    head.contentType,
    input.objectKey,
    ALLOWED_IMAGE_TYPES,
  );
  try {
    assertAllowedContentType(contentType);
  } catch (error) {
    throw validationError(error);
  }
  const maxBytes = maxBytesForKind('avatar', config.avatarMaxBytes, config.tripCoverMaxBytes);
  if (head.contentLength <= 0 || head.contentLength > maxBytes) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The uploaded file does not match the request.');
  }

  const user = await findUser(userId);
  const previousKey = user.avatarObjectKey ?? null;
  user.avatarObjectKey = input.objectKey;
  await user.save();
  await tryDeleteStoredObject(previousKey);
  return publicUserFromDocument(user);
}

export async function updateProfileForUser(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await findUser(userId);

  if (input.name !== undefined) {
    user.name = input.name;
  }

  if (input.email !== undefined && input.email !== user.email) {
    const emailTaken = await UserModel.exists({ email: input.email, _id: { $ne: userId } });
    if (emailTaken) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    user.email = input.email;
  }

  if (input.username !== undefined) {
    const username = normalizeUsername(input.username);
    const formatError = validateUsernameFormat(username);
    if (formatError) {
      throw new AppError(400, 'VALIDATION_ERROR', formatError);
    }
    if (user.username !== username) {
      const taken = await UserModel.exists({ username, _id: { $ne: userId } });
      if (taken) {
        throw new AppError(409, 'USERNAME_IN_USE', 'Username already taken.');
      }
      user.username = username;
    }
  }

  try {
    await user.save();
  } catch (error) {
    if (isDuplicateKey(error)) {
      const field = duplicateKeyField(error);
      if (field === 'username') {
        throw new AppError(409, 'USERNAME_IN_USE', 'Username already taken.');
      }
      if (field === 'email') {
        throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
      }
    }
    throw error;
  }

  return publicUserFromDocument(user);
}

export async function deleteAvatar(userId: string): Promise<PublicUser> {
  assertObjectStorageAvailable();
  const user = await findUser(userId);
  const previousKey = user.avatarObjectKey ?? null;
  user.avatarObjectKey = null;
  await user.save();
  await tryDeleteStoredObject(previousKey);
  return publicUserFromDocument(user);
}

export type UserSummary = {
  name: string;
  avatarUrl: string | null;
};

export async function loadUserSummaries(userIds: string[]): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(userIds.filter((id) => mongoose.isValidObjectId(id)))];
  if (unique.length === 0) {
    return new Map();
  }

  const users = await UserModel.find({ _id: { $in: unique } })
    .select('name avatarObjectKey')
    .lean();
  const entries = await Promise.all(
    users.map(async (user) => {
      const id = user._id.toString();
      let avatarUrl: string | null = null;
      if (user.avatarObjectKey) {
        try {
          avatarUrl = await createPresignedGetUrl(user.avatarObjectKey);
        } catch {
          avatarUrl = null;
        }
      }
      return [id, { name: user.name, avatarUrl }] as const;
    }),
  );
  return new Map(entries);
}

export async function publicUserFromDocument(
  user: Pick<UserDocument, '_id' | 'name' | 'email' | 'username' | 'avatarObjectKey'>,
): Promise<PublicUser> {
  let avatarUrl: string | null = null;
  if (user.avatarObjectKey) {
    try {
      avatarUrl = await createPresignedGetUrl(user.avatarObjectKey);
    } catch {
      avatarUrl = null;
    }
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    username: user.username ?? null,
    avatarUrl,
  };
}

async function findUser(userId: string): Promise<UserDocument> {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }
  return user;
}

function validationError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : 'Invalid upload request.';
  return new AppError(400, 'VALIDATION_ERROR', message);
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
