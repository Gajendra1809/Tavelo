import { z } from 'zod';
import { POLL_CATEGORIES, POLL_VOTE_TYPES } from './poll.model';

const optionalHttpsUrl = z
  .union([
    z
      .string()
      .trim()
      .url('Use a valid link.')
      .refine((value) => value.startsWith('https://'), 'Use an https link.')
      .max(500, 'Use 500 characters or fewer.'),
    z.literal('').transform(() => null),
    z.null(),
  ])
  .optional();

const pollOptionInputSchema = z
  .object({
    label: z.string().trim().min(1, 'Enter an option.').max(120, 'Use 120 characters or fewer.'),
    description: z.string().trim().max(300, 'Use 300 characters or fewer.').optional().default(''),
    imageUrl: optionalHttpsUrl,
    linkUrl: optionalHttpsUrl,
  })
  .strip();

const deadlineAtSchema = z
  .union([
    z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Use a valid deadline.'),
    z.literal('').transform(() => null),
    z.null(),
  ])
  .optional();

export const createPollSchema = z
  .object({
    question: z.string().trim().min(1, 'Enter a question.').max(160, 'Use 160 characters or fewer.'),
    description: z.string().trim().max(500, 'Use 500 characters or fewer.').optional().default(''),
    category: z.enum(POLL_CATEGORIES).optional().default('other'),
    voteType: z.enum(POLL_VOTE_TYPES).optional().default('single'),
    maxChoices: z.number().int().min(2).max(10).optional().nullable(),
    anonymous: z.boolean().optional().default(false),
    allowAddOptions: z.boolean().optional().default(false),
    deadlineAt: deadlineAtSchema,
    options: z.array(pollOptionInputSchema).min(2, 'Add at least two options.').max(10, 'Use 10 options or fewer.'),
  })
  .strip()
  .refine((value) => new Set(value.options.map((option) => option.label.toLowerCase())).size === value.options.length, {
    message: 'Options must be unique.',
    path: ['options'],
  })
  .refine((value) => value.voteType === 'multiple' || value.maxChoices == null, {
    message: 'Max choices is only used for multiple-choice polls.',
    path: ['maxChoices'],
  })
  .refine(
    (value) => value.maxChoices == null || value.maxChoices <= value.options.length,
    {
      message: 'Max choices cannot exceed the number of options.',
      path: ['maxChoices'],
    },
  );

export const updatePollSchema = z
  .object({
    question: z.string().trim().min(1, 'Enter a question.').max(160, 'Use 160 characters or fewer.').optional(),
    description: z.string().trim().max(500, 'Use 500 characters or fewer.').optional(),
    deadlineAt: deadlineAtSchema,
    allowAddOptions: z.boolean().optional(),
  })
  .strip()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update.',
  });

export const addPollOptionSchema = pollOptionInputSchema;

export const votePollSchema = z
  .object({
    optionIds: z
      .array(z.string().trim().length(24).regex(/^[a-f0-9]{24}$/i, 'Choose a valid option.'))
      .min(1, 'Choose at least one option.')
      .max(10, 'Too many options.'),
  })
  .strip();

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type UpdatePollInput = z.infer<typeof updatePollSchema>;
export type AddPollOptionInput = z.infer<typeof addPollOptionSchema>;
export type VotePollInput = z.infer<typeof votePollSchema>;
