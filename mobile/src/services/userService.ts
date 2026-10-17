import {
  USERNAME_AVAILABLE_PATH,
  USERS_ME_PATH,
  USERS_SEARCH_PATH,
} from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { AuthUser } from '@/types/auth';
import type { UserSearchHit, UsernameAvailability } from '@/types/user';

export function checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
  const query = encodeURIComponent(username.trim());
  return apiRequest<UsernameAvailability>(`${USERNAME_AVAILABLE_PATH}?username=${query}`, {
    auth: false,
  });
}

export function searchUsers(q: string, limit = 20): Promise<{ users: UserSearchHit[] }> {
  const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  return apiRequest<{ users: UserSearchHit[] }>(`${USERS_SEARCH_PATH}?${params.toString()}`);
}

export function setMyUsername(username: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`${USERS_ME_PATH}/username`, {
    method: 'POST',
    body: JSON.stringify({ username: username.trim() }),
  });
}

export function updateMyProfile(input: {
  name?: string;
  email?: string;
  username?: string;
}): Promise<AuthUser> {
  return apiRequest<AuthUser>(USERS_ME_PATH, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function checkProfileUsernameAvailability(username: string): Promise<UsernameAvailability> {
  const query = encodeURIComponent(username.trim());
  return apiRequest<UsernameAvailability>(`${USERS_ME_PATH}/username-available?username=${query}`);
}
