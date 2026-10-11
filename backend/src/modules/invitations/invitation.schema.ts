import { z } from 'zod';

export const inviteSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Enter a valid email address.')
      .max(254, 'Enter a valid email address.')
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'),
  })
  .strip();

export type InviteInput = z.infer<typeof inviteSchema>;
