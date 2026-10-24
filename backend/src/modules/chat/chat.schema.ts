import { z } from 'zod';

export const MESSAGE_MAX_LENGTH = 2000;

export const listMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(30),
    before: z.string().trim().optional(),
    after: z.string().trim().optional(),
  })
  .strip();

export const createMessageSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Write a message.')
      .max(MESSAGE_MAX_LENGTH, `Use ${MESSAGE_MAX_LENGTH} characters or fewer.`),
    clientNonce: z
      .string()
      .trim()
      .min(8, 'Use a longer send key.')
      .max(64, 'Use 64 characters or fewer.')
      .optional(),
  })
  .strip();

export const markChatReadSchema = z
  .object({
    messageId: z
      .string()
      .trim()
      .length(24, 'Choose a message.')
      .regex(/^[a-f0-9]{24}$/i, 'Choose a message.'),
  })
  .strip();

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type MarkChatReadInput = z.infer<typeof markChatReadSchema>;
