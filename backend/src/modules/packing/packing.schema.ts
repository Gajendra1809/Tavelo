import { z } from 'zod';

const itemName = z.string().trim().min(1, 'Enter an item name.').max(120, 'Use 120 characters or fewer.');

const optionalOwnerId = z
  .union([
    z
      .string()
      .trim()
      .length(24, 'Choose a person on this trip.')
      .regex(/^[a-f0-9]{24}$/i, 'Choose a person on this trip.'),
    z.literal('').transform(() => null),
    z.null(),
  ])
  .optional();

export const createGroupPackingSchema = z
  .object({
    name: itemName,
    ownerId: optionalOwnerId,
  })
  .strip();

export const updateGroupPackingSchema = z
  .object({
    name: itemName.optional(),
    packed: z.boolean().optional(),
    ownerId: optionalOwnerId,
  })
  .strip()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update.',
  });

export const createPersonalPackingSchema = z
  .object({
    name: itemName,
  })
  .strip();

export const updatePersonalPackingSchema = z
  .object({
    name: itemName.optional(),
    packed: z.boolean().optional(),
  })
  .strip()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update.',
  });

export type CreateGroupPackingInput = z.infer<typeof createGroupPackingSchema>;
export type UpdateGroupPackingInput = z.infer<typeof updateGroupPackingSchema>;
export type CreatePersonalPackingInput = z.infer<typeof createPersonalPackingSchema>;
export type UpdatePersonalPackingInput = z.infer<typeof updatePersonalPackingSchema>;
