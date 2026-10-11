import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter a valid email address.')
  .max(254, 'Enter a valid email address.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.');

const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use 80 characters or fewer.'),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(72, 'Use 72 characters or fewer.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(20, 'Refresh token is missing.').max(500),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
