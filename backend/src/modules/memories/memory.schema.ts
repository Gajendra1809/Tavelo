import { z } from 'zod';
import { ALLOWED_IMAGE_TYPES, ALLOWED_MEMORY_VIDEO_TYPES } from '../storage/policy';

const memoryContentType = z
  .string()
  .trim()
  .refine(
    (value) => ALLOWED_IMAGE_TYPES.has(value) || ALLOWED_MEMORY_VIDEO_TYPES.has(value),
    'Use a JPEG, PNG, WebP, MP4, or MOV file.',
  );

export const memoryUploadIntentSchema = z.object({
  contentType: memoryContentType,
  byteSize: z.number().int('Use a whole byte size.').min(1, 'The file is empty.'),
});

export const createMemorySchema = z.object({
  objectKey: z.string().trim().min(1, 'Missing object key.').max(512, 'Object key is too long.'),
  thumbnailObjectKey: z.string().trim().min(1).max(512).optional(),
  caption: z.string().trim().max(500, 'Caption is too long.').optional(),
  originalFilename: z.string().trim().max(255, 'Filename is too long.').optional(),
  capturedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for capture date.')
    .optional(),
});

export const updateMemoryCaptionSchema = z.object({
  caption: z.string().trim().max(500, 'Caption is too long.'),
});

export const listMemoriesQuerySchema = z.object({
  filter: z.enum(['all', 'image', 'video']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  cursor: z.string().trim().optional(),
});

export type MemoryUploadIntentInput = z.infer<typeof memoryUploadIntentSchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryCaptionInput = z.infer<typeof updateMemoryCaptionSchema>;
export type ListMemoriesQuery = z.infer<typeof listMemoriesQuerySchema>;
