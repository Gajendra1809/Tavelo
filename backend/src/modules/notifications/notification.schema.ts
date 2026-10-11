import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  cursor: z.string().trim().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
