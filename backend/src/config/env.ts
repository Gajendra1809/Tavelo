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
});

export type AppEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  MONGODB_URI: string;
  API_PREFIX: string;
  CORS_ORIGINS: string[];
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
