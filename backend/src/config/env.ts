import dotenv from 'dotenv';
import path from 'path';
import { ZodError, z } from 'zod';
import { redactSecrets } from '../utils/sanitize';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .trim()
    .optional()
    .transform((value) => Number(value === undefined || value === '' ? '4000' : value))
    .pipe(z.number().int().min(1).max(65535)),
  MONGODB_URI: z
    .string()
    .trim()
    .regex(
      /^mongodb(\+srv)?:\/\/.+/,
      'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    ),
  API_PREFIX: z
    .string()
    .trim()
    .regex(
      /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?\/?$/,
      'API_PREFIX must be a URL path',
    )
    .default('/api/v1'),
  CORS_ORIGINS: z.string().optional().default(''),
  JWT_ACCESS_SECRET: z
    .string()
    .trim()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters.'),
  ACCESS_TOKEN_TTL_SECONDS: z
    .string()
    .trim()
    .optional()
    .transform((value) => Number(value === undefined || value === '' ? '900' : value))
    .pipe(z.number().int().min(60).max(3600)),
  REFRESH_TOKEN_TTL_DAYS: z
    .string()
    .trim()
    .optional()
    .transform((value) => Number(value === undefined || value === '' ? '30' : value))
    .pipe(z.number().int().min(1).max(90)),
});

export type AppEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  MONGODB_URI: string;
  API_PREFIX: string;
  CORS_ORIGINS: string[];
  JWT_ACCESS_SECRET: string;
  ACCESS_TOKEN_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
};

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvConfigError';
  }
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function parseEnv(source: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvConfigError(formatEnvError(parsed.error, source));
  }

  const origins = parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.includes('*')) {
    throw new EnvConfigError(
      'Environment configuration is invalid.\n- CORS_ORIGINS: List explicit origins. A wildcard is not allowed.',
    );
  }

  if (
    parsed.data.NODE_ENV === 'production' &&
    parsed.data.JWT_ACCESS_SECRET.startsWith('replace-with')
  ) {
    throw new EnvConfigError(
      'Environment configuration is invalid.\n- JWT_ACCESS_SECRET: Replace the example value before production.',
    );
  }

  const prefix =
    parsed.data.API_PREFIX.length > 1
      ? parsed.data.API_PREFIX.replace(/\/+$/, '')
      : parsed.data.API_PREFIX;

  return {
    NODE_ENV: parsed.data.NODE_ENV,
    PORT: parsed.data.PORT,
    MONGODB_URI: parsed.data.MONGODB_URI,
    API_PREFIX: prefix,
    CORS_ORIGINS: origins,
    JWT_ACCESS_SECRET: parsed.data.JWT_ACCESS_SECRET,
    ACCESS_TOKEN_TTL_SECONDS: parsed.data.ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_DAYS: parsed.data.REFRESH_TOKEN_TTL_DAYS,
  };
}

function formatEnvError(error: ZodError, source: NodeJS.ProcessEnv): string {
  const lines = error.issues.map((issue) => {
    const key = issue.path.map((part) => String(part)).join('.') || 'env';
    const received = source[key];
    let message = issue.message;
    if (typeof received === 'string' && received.length > 0) {
      message = redactSecrets(message.split(received).join('[redacted]'));
    }
    return `- ${key}: ${redactSecrets(message)}`;
  });

  return `Environment configuration is invalid.\n${lines.join('\n')}`;
}
