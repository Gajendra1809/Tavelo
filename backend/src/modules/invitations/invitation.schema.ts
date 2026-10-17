import mongoose from 'mongoose';
import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter a valid email address.')
  .max(254, 'Enter a valid email address.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.');

export const inviteSchema = z
  .object({
    email: emailField.optional(),
    userId: z.string().trim().optional(),
  })
  .strip()
  .superRefine((value, ctx) => {
    const hasEmail = Boolean(value.email);
    const hasUserId = Boolean(value.userId);
    if (hasEmail === hasUserId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either userId or email.',
      });
      return;
    }
    if (value.userId && !mongoose.isValidObjectId(value.userId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use a valid user id.',
        path: ['userId'],
      });
    }
  });

export type InviteInput = z.infer<typeof inviteSchema>;
