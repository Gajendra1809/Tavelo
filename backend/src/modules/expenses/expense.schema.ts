import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine(isRealDate, 'Use a valid date.');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Use a valid id.');

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code.')
  .default('INR');

const category = z.enum(['food', 'transport', 'lodging', 'activities', 'shopping', 'other']);

const shareInput = z.object({
  userId: objectId,
  amountMinor: z.number().int('Use whole minor units.').min(0, 'Shares cannot be negative.'),
});

const baseExpenseBody = z.object({
  description: z.string().trim().min(1, 'Enter a description.').max(200, 'Use 200 characters or fewer.'),
  amountMinor: z.number().int('Use whole minor units.').min(1, 'Enter an amount greater than zero.'),
  currency: currencyCode.optional(),
  category,
  paidBy: objectId,
  expenseDate: dateOnly,
});

const equalExpenseBody = baseExpenseBody
  .extend({
    splitMethod: z.literal('equal'),
    participantIds: z.array(objectId).min(1, 'Choose at least one participant.'),
  })
  .strip();

const customExpenseBody = baseExpenseBody
  .extend({
    splitMethod: z.literal('custom'),
    shares: z.array(shareInput).min(1, 'Add at least one share.'),
  })
  .strip();

export const createExpenseSchema = z.discriminatedUnion('splitMethod', [
  equalExpenseBody,
  customExpenseBody,
]);

export const updateExpenseSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, 'Enter a description.')
      .max(200, 'Use 200 characters or fewer.')
      .optional(),
    amountMinor: z.number().int('Use whole minor units.').min(1, 'Enter an amount greater than zero.').optional(),
    currency: currencyCode.optional(),
    category: category.optional(),
    paidBy: objectId.optional(),
    expenseDate: dateOnly.optional(),
    splitMethod: z.enum(['equal', 'custom']).optional(),
    participantIds: z.array(objectId).min(1, 'Choose at least one participant.').optional(),
    shares: z.array(shareInput).min(1, 'Add at least one share.').optional(),
  })
  .strip()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'Nothing to update.',
  });

export const createSettlementSchema = z
  .object({
    payerId: objectId,
    recipientId: objectId,
    amountMinor: z.number().int('Use whole minor units.').min(1, 'Enter an amount greater than zero.'),
    currency: currencyCode.optional(),
    note: z.string().trim().max(300, 'Use 300 characters or fewer.').optional().default(''),
  })
  .strip()
  .refine((value) => value.payerId !== value.recipientId, {
    path: ['recipientId'],
    message: 'Choose a different recipient.',
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
