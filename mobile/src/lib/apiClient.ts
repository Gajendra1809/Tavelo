import type { ApiFailure, ApiSuccess } from '@/types/api';
import { readApiConfig } from './config';
import { clearSession, getAccessToken, refreshSession } from './session';

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

type ApiRequestOptions = Omit<RequestInit, 'signal' | 'headers'> & {
  acceptedStatuses?: number[];
  timeoutMs?: number;
  headers?: Record<string, string>;
  auth?: boolean;
  retried?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const config = readApiConfig();
  if ('error' in config) {
    throw new ApiError(config.error, 'CONFIG_ERROR');
  }

  const useAuth = options.auth !== false;
  let token = useAuth ? getAccessToken() : null;
  if (useAuth && !token) {
    const refreshed = await refreshSession();
    token = refreshed.status === 'ok' ? getAccessToken() : null;
  }

  try {
    return await send<T>(config.baseUrl, path, options, token);
  } catch (error) {
    if (useAuth && !options.retried && error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshSession();
      const nextToken = refreshed.status === 'ok' ? getAccessToken() : null;
      if (refreshed.status === 'signed-out' || !nextToken) {
        await clearSession();
        throw new ApiError('Your session has ended. Sign in again.', 'SESSION_EXPIRED', 401);
      }
      return send<T>(config.baseUrl, path, { ...options, retried: true }, nextToken);
    }
    throw error;
  }
}

async function send<T>(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions,
  token: string | null,
): Promise<T> {
  const { acceptedStatuses, timeoutMs = DEFAULT_TIMEOUT_MS, headers, auth: _auth, retried: _retried, ...init } =
    options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      signal: controller.signal,
    });

    const payload = await readJson(response);
    const statusAccepted = acceptedStatuses
      ? acceptedStatuses.includes(response.status)
      : response.ok;

    if (isSuccessPayload<T>(payload) && statusAccepted) {
      return payload.data;
    }

    if (isErrorPayload(payload)) {
      throw new ApiError(payload.error.message, payload.error.code, response.status);
    }

    throw new ApiError(
      'The API returned an unexpected response.',
      'UNEXPECTED_RESPONSE',
      response.status,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new ApiError(
        'The request timed out. Check that the API is running and that this device can reach the API URL.',
        'TIMEOUT',
      );
    }
    throw new ApiError(
      'Could not reach the API. On a phone, use your computer’s LAN IP in EXPO_PUBLIC_API_URL and allow the API port through the firewall.',
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isSuccessPayload<T>(payload: unknown): payload is ApiSuccess<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    payload.success === true &&
    'data' in payload
  );
}

function isErrorPayload(payload: unknown): payload is ApiFailure {
  if (typeof payload !== 'object' || payload === null || !('success' in payload)) {
    return false;
  }
  if (payload.success !== false || !('error' in payload)) {
    return false;
  }

  const error = payload.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
