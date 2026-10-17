import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { UserModel } from '../auth/user.model';
import { normalizeUsername, validateUsernameFormat } from './username';
import { createPresignedGetUrl } from '../storage/objectStore';

export type UserSearchHit = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;
const MIN_QUERY_LENGTH = 2;

export async function searchUsers(
  requesterId: string,
  rawQuery: string,
  limitInput?: number,
): Promise<{ users: UserSearchHit[] }> {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The database is unavailable. Try again in a moment.',
    );
  }

  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return { users: [] };
  }

  const limit = Math.min(Math.max(limitInput ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const escaped = escapeRegex(query);
  const normalized = normalizeUsername(query);
  const formatError = validateUsernameFormat(normalized);

  const orFilters: Record<string, unknown>[] = [
    { name: { $regex: escaped, $options: 'i' } },
    { email: { $regex: `^${escaped}`, $options: 'i' } },
  ];
  if (!formatError && normalized.length >= 2) {
    orFilters.push({ username: { $regex: `^${escapeRegex(normalized)}` } });
  }

  const docs = await UserModel.find({
    _id: { $ne: requesterId },
    $or: orFilters,
  })
    .select('name email username avatarObjectKey')
    .sort({ username: 1, name: 1 })
    .limit(limit)
    .lean();

  const users = await Promise.all(
    docs.map(async (user) => {
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
        username: user.username ?? null,
        email: user.email,
        avatarUrl,
      };
    }),
  );

  return { users };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
