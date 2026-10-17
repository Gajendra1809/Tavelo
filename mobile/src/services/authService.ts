import { LOGIN_PATH, LOGOUT_PATH, REGISTER_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import { clearSession, persistSession } from '@/lib/session';
import { readToken, tokenKeys } from '@/lib/tokenStore';
import { normalizeLoginIdentifier } from '@/lib/username';
import type { AuthSession, AuthUser } from '@/types/auth';

export async function registerAccount(input: {
  name: string;
  username: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  const session = await apiRequest<AuthSession>(REGISTER_PATH, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      name: input.name.trim(),
      username: input.username.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }),
  });
  await persistSession(session);
  return session.user;
}

export async function loginAccount(input: { email: string; password: string }): Promise<AuthUser> {
  const identifier = normalizeLoginIdentifier(input.email);
  const session = await apiRequest<AuthSession>(LOGIN_PATH, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      email: identifier,
      password: input.password,
    }),
  });
  await persistSession(session);
  return session.user;
}

export async function logoutAccount(): Promise<void> {
  const refreshToken = await readToken(tokenKeys.refreshToken);
  try {
    if (refreshToken) {
      await apiRequest(LOGOUT_PATH, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Local sign-out still happens when the API cannot be reached.
  }
  await clearSession();
}
