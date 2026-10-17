import { z } from 'zod';
import { usernameFieldSchema } from './username';

const profileEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter a valid email address.')
  .max(254, 'Enter a valid email address.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.');

export const userSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  limit: z.coerce.number().int().min(1).max(30).optional().default(20),
});

export const setUsernameSchema = z.object({
  username: usernameFieldSchema,
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use 80 characters or fewer.').optional(),
    email: profileEmail.optional(),
    username: usernameFieldSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined || data.username !== undefined, {
    message: 'Nothing to update.',
  });

export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;
export type SetUsernameInput = z.infer<typeof setUsernameSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
