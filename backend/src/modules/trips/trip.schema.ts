import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine(isRealDate, 'Use a valid date.');

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a trip name.').max(80, 'Use 80 characters or fewer.'),
    destination: z
      .string()
      .trim()
      .min(1, 'Enter a destination.')
      .max(120, 'Use 120 characters or fewer.'),
    startDate: dateOnly,
    endDate: dateOnly,
    description: z
      .string()
      .trim()
      .max(500, 'Use 500 characters or fewer.')
      .optional()
      .default(''),
  })
  .strip()
  .refine((trip) => trip.endDate >= trip.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date.',
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;

const optionalText = (max: number, emptyMessage: string, longMessage: string) =>
  z.string().trim().min(1, emptyMessage).max(max, longMessage);

export const updateTripSchema = z
  .object({
    name: optionalText(80, 'Enter a trip name.', 'Use 80 characters or fewer.').optional(),
    destination: optionalText(
      120,
      'Enter a destination.',
      'Use 120 characters or fewer.',
    ).optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    description: z.string().trim().max(500, 'Use 500 characters or fewer.').optional(),
  })
  .strip()
  .refine((trip) => Object.values(trip).some((value) => value !== undefined), {
    message: 'Nothing to update.',
  })
  .refine((trip) => !trip.startDate || !trip.endDate || trip.endDate >= trip.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date.',
  });

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

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
