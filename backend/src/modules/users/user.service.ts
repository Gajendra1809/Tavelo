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
  assertAllowedContentType,
  assertAvatarObjectKey,
  buildAvatarObjectKey,
  maxBytesForKind,
} from '../storage/policy';
import type { UploadCompleteInput, UploadIntentInput } from '../storage/storage.schema';

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
  try {
    assertAllowedContentType(head.contentType);
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
  user: Pick<UserDocument, '_id' | 'name' | 'email' | 'avatarObjectKey'>,
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
