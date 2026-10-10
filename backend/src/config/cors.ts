import cors from 'cors';
import { AppError } from '../utils/AppError';
import type { AppEnv } from './env';

const LOCAL_PROTOCOLS = new Set(['http:', 'https:', 'exp:']);

export function createCorsMiddleware(env: AppEnv) {
  return cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, env)) {
        callback(null, origin ?? true);
        return;
      }

      callback(
        new AppError(403, 'FORBIDDEN', 'This origin is not allowed to call the API.'),
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
    maxAge: 600,
  });
}

export function isOriginAllowed(origin: string | undefined, env: AppEnv): boolean {
  if (!origin) {
    return true;
  }

  if (env.CORS_ORIGINS.includes(origin)) {
    return true;
  }

  return env.NODE_ENV === 'development' && isLocalDevOrigin(origin);
}

function isLocalDevOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (!LOCAL_PROTOCOLS.has(url.protocol)) {
    return false;
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true;
  }

  const parts = host.split('.').map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = parts;
  if (first === undefined || second === undefined) {
    return false;
  }

  if (first === 10 || (first === 192 && second === 168)) {
    return true;
  }

  return first === 172 && second >= 16 && second <= 31;
}
