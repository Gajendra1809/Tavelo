import { z } from 'zod';
import { ALLOWED_IMAGE_TYPES } from './policy';

const allowedContentType = z
  .string()
  .trim()
  .refine((value) => ALLOWED_IMAGE_TYPES.has(value), 'Use a JPEG, PNG, or WebP image.');

export const uploadIntentSchema = z.object({
  contentType: allowedContentType,
  byteSize: z.number().int('Use a whole byte size.').min(1, 'The file is empty.'),
});

export const uploadCompleteSchema = z.object({
  objectKey: z.string().trim().min(1, 'Missing object key.').max(512, 'Object key is too long.'),
});

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;
export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;
