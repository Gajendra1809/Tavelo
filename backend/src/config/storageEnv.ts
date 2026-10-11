import { ZodError, z } from 'zod';
import { redactSecrets } from '../utils/sanitize';

const booleanFromEnv = z
  .string()
  .trim()
  .optional()
  .transform((value) => value === 'true' || value === '1');

const positiveInt = (fallback: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => Number(value === undefined || value === '' ? String(fallback) : value))
    .pipe(z.number().int().min(1).max(max));

const storageSchema = z.object({
  STORAGE_ENABLED: booleanFromEnv,
  SUPABASE_URL: z.string().trim().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().trim().optional(),
  SIGNED_URL_TTL_SECONDS: positiveInt(3600, 86_400),
  AVATAR_MAX_BYTES: positiveInt(5_242_880, 52_428_800),
  TRIP_COVER_MAX_BYTES: positiveInt(10_485_760, 104_857_600),
  MEMORY_IMAGE_MAX_BYTES: positiveInt(15_728_640, 104_857_600),
  MEMORY_VIDEO_MAX_BYTES: positiveInt(104_857_600, 524_288_000),
  BOOKING_ATTACHMENT_MAX_BYTES: positiveInt(15_728_640, 104_857_600),
});

export type StorageConfig = {
  enabled: boolean;
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  signedUrlTtlSeconds: number;
  avatarMaxBytes: number;
  tripCoverMaxBytes: number;
  memoryImageMaxBytes: number;
  memoryVideoMaxBytes: number;
  bookingAttachmentMaxBytes: number;
};

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigError';
  }
}

let cached: StorageConfig | null = null;

export function getStorageConfig(): StorageConfig {
  if (!cached) {
    cached = parseStorageConfig(process.env);
  }
  return cached;
}

export function resetStorageConfigCache(): void {
  cached = null;
}

export function parseStorageConfig(source: NodeJS.ProcessEnv): StorageConfig {
  const parsed = storageSchema.safeParse(source);
  if (!parsed.success) {
    throw new StorageConfigError(formatStorageError(parsed.error, source));
  }

  const enabled = parsed.data.STORAGE_ENABLED ?? false;
  if (!enabled) {
    return {
      enabled: false,
      supabaseUrl: '',
      serviceRoleKey: '',
      bucket: '',
      signedUrlTtlSeconds: parsed.data.SIGNED_URL_TTL_SECONDS,
      avatarMaxBytes: parsed.data.AVATAR_MAX_BYTES,
      tripCoverMaxBytes: parsed.data.TRIP_COVER_MAX_BYTES,
      memoryImageMaxBytes: parsed.data.MEMORY_IMAGE_MAX_BYTES,
      memoryVideoMaxBytes: parsed.data.MEMORY_VIDEO_MAX_BYTES,
      bookingAttachmentMaxBytes: parsed.data.BOOKING_ATTACHMENT_MAX_BYTES,
    };
  }

  const missing: string[] = [];
  if (!parsed.data.SUPABASE_URL) {
    missing.push('SUPABASE_URL');
  }
  if (!parsed.data.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!parsed.data.SUPABASE_STORAGE_BUCKET) {
    missing.push('SUPABASE_STORAGE_BUCKET');
  }
  if (missing.length > 0) {
    throw new StorageConfigError(
      `Storage is enabled but required variables are missing: ${missing.join(', ')}.`,
    );
  }

  const url = parsed.data.SUPABASE_URL!;
  if (!url.startsWith('https://')) {
    throw new StorageConfigError('SUPABASE_URL must start with https://.');
  }

  return {
    enabled: true,
    supabaseUrl: url.replace(/\/+$/, ''),
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY!,
    bucket: parsed.data.SUPABASE_STORAGE_BUCKET!,
    signedUrlTtlSeconds: parsed.data.SIGNED_URL_TTL_SECONDS,
    avatarMaxBytes: parsed.data.AVATAR_MAX_BYTES,
    tripCoverMaxBytes: parsed.data.TRIP_COVER_MAX_BYTES,
    memoryImageMaxBytes: parsed.data.MEMORY_IMAGE_MAX_BYTES,
    memoryVideoMaxBytes: parsed.data.MEMORY_VIDEO_MAX_BYTES,
    bookingAttachmentMaxBytes: parsed.data.BOOKING_ATTACHMENT_MAX_BYTES,
  };
}

export function assertStorageEnabled(): StorageConfig {
  const config = getStorageConfig();
  if (!config.enabled) {
    throw new StorageConfigError('Object storage is not configured.');
  }
  return config;
}

function formatStorageError(error: ZodError, source: NodeJS.ProcessEnv): string {
  const lines = error.issues.map((issue) => {
    const key = issue.path.map((part) => String(part)).join('.') || 'env';
    const received = source[key];
    let message = issue.message;
    if (typeof received === 'string' && received.length > 0) {
      message = redactSecrets(message.split(received).join('[redacted]'));
    }
    return `- ${key}: ${redactSecrets(message)}`;
  });
  return `Storage configuration is invalid.\n${lines.join('\n')}`;
}
