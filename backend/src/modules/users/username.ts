import { z } from 'zod';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_CHARS = /^[a-z0-9._]+$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Sign-in identifier: lowercased email or normalized username; strips a leading `@`. */
export function normalizeLoginIdentifier(raw: string): string {
  let id = raw.trim();
  if (id.startsWith('@')) {
    id = id.slice(1);
  }
  if (id.includes('@')) {
    return id.toLowerCase();
  }
  return normalizeUsername(id);
}

export function validateUsernameFormat(normalized: string): string | null {
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `Use ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }
  if (!USERNAME_CHARS.test(normalized)) {
    return 'Use only letters, numbers, periods, and underscores.';
  }
  if (normalized.startsWith('.') || normalized.endsWith('.')) {
    return 'Username cannot start or end with a period.';
  }
  if (normalized.includes('..')) {
    return 'Username cannot contain consecutive periods.';
  }
  return null;
}

export const usernameFieldSchema = z
  .string()
  .trim()
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const message = validateUsernameFormat(value);
    if (message) {
      ctx.addIssue({ code: 'custom', message });
    }
  });
