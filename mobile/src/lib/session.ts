import { REFRESH_PATH } from '@/constants/api';
import type { ApiSuccess } from '@/types/api';
import type { AuthSession, AuthUser } from '@/types/auth';
import { readApiConfig } from './config';
import { singleFlight } from './singleFlight';
import { deleteToken, readToken, tokenKeys, writeToken } from './tokenStore';

export type RefreshResult =
  | { status: 'ok'; user: AuthUser }
  | { status: 'signed-out' }
  | { status: 'offline' };

let accessToken: string | null = null;
let accessExpiresAt = 0;
const listeners = new Set<(user: AuthUser | null) => void>();

export function subscribeSession(listener: (user: AuthUser | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  if (!accessToken || accessExpiresAt <= Date.now() + 30_000) {
    return null;
  }
  return accessToken;
}

export async function restoreSession(): Promise<AuthUser | null> {
  await loadStoredAccessToken();
  const refreshed = await refreshSession();
  if (refreshed.status === 'ok') {
    return refreshed.user;
  }
  if (refreshed.status === 'offline') {
    return readStoredUser();
  }
  return null;
}

export async function applyUserUpdate(user: AuthUser): Promise<void> {
  await writeToken(tokenKeys.user, JSON.stringify(user));
  emit(user);
}

export async function persistSession(session: AuthSession): Promise<void> {
  accessToken = session.accessToken;
  accessExpiresAt = Date.now() + session.expiresIn * 1000;
  await writeToken(tokenKeys.accessToken, session.accessToken);
  await writeToken(tokenKeys.refreshToken, session.refreshToken);
  await writeToken(tokenKeys.accessExpiresAt, String(accessExpiresAt));
  await writeToken(tokenKeys.user, JSON.stringify(session.user));
  emit(session.user);
}

export const refreshSession = singleFlight(async (): Promise<RefreshResult> => {
  const refreshToken = await readToken(tokenKeys.refreshToken);
  if (!refreshToken) {
    await clearSession();
    return { status: 'signed-out' };
  }

  const config = readApiConfig();
  if ('error' in config) {
    return { status: 'offline' };
  }

  try {
    const response = await fetch(`${config.baseUrl}${REFRESH_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status === 401 || response.status === 403) {
      await clearSession();
      return { status: 'signed-out' };
    }
    const payload = (await response.json()) as ApiSuccess<AuthSession> | null;
    if (!response.ok || !payload || payload.success !== true) {
      return { status: 'offline' };
    }
    await persistSession(payload.data);
    return { status: 'ok', user: payload.data.user };
  } catch {
    return { status: 'offline' };
  }
});

export async function clearSession(): Promise<void> {
  accessToken = null;
  accessExpiresAt = 0;
  await Promise.all(Object.values(tokenKeys).map((key) => deleteToken(key)));
  emit(null);
}

async function loadStoredAccessToken(): Promise<void> {
  const storedAccess = await readToken(tokenKeys.accessToken);
  const storedExpiry = Number((await readToken(tokenKeys.accessExpiresAt)) ?? '0');
  if (storedAccess && storedExpiry > Date.now() + 30_000) {
    accessToken = storedAccess;
    accessExpiresAt = storedExpiry;
  }
}

async function readStoredUser(): Promise<AuthUser | null> {
  const raw = await readToken(tokenKeys.user);
  if (!raw) {
    return null;
  }
  try {
    const user = JSON.parse(raw) as AuthUser;
    if (!user.id || !user.email || !user.name) {
      return null;
    }
    emit(user);
    return user;
  } catch {
    return null;
  }
}

function emit(user: AuthUser | null): void {
  for (const listener of listeners) {
    listener(user);
  }
}
