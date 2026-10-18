import { z } from 'zod';
import { nullableTaveloPlaceSchema } from '../places/place.schema';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine(isRealDate, 'Use a valid date.');

const clockTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Use a time like 09:30.')
  .refine(isValidClockTime, 'Use a valid time.');

const optionalClockTime = z
  .union([clockTime, z.literal('').transform(() => null), z.null()])
  .optional();

export const listActivitiesQuerySchema = z
  .object({
    date: dateOnly.optional(),
  })
  .strip();

export const createActivitySchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or fewer.'),
    location: z
      .string()
      .trim()
      .max(200, 'Use 200 characters or fewer.')
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    date: dateOnly,
    startTime: optionalClockTime,
    endTime: optionalClockTime,
    notes: z.string().trim().max(1000, 'Use 1000 characters or fewer.').optional().default(''),
    place: nullableTaveloPlaceSchema.optional(),
  })
  .strip()
  .refine((activity) => isTimeRangeValid(activity.startTime ?? null, activity.endTime ?? null), {
    path: ['endTime'],
    message: 'End time must be on or after the start time.',
  });

export const updateActivitySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title.')
      .max(120, 'Use 120 characters or fewer.')
      .optional(),
    location: z
      .union([
        z.string().trim().max(200, 'Use 200 characters or fewer.'),
        z.literal('').transform(() => null),
        z.null(),
      ])
      .optional(),
    date: dateOnly.optional(),
    startTime: optionalClockTime,
    endTime: optionalClockTime,
    notes: z.string().trim().max(1000, 'Use 1000 characters or fewer.').optional(),
    place: nullableTaveloPlaceSchema.optional(),
  })
  .strip()
  .refine((activity) => Object.values(activity).some((value) => value !== undefined), {
    message: 'Nothing to update.',
  })
  .refine(
    (activity) =>
      !activity.startTime ||
      !activity.endTime ||
      isTimeRangeValid(activity.startTime ?? null, activity.endTime ?? null),
    {
      path: ['endTime'],
      message: 'End time must be on or after the start time.',
    },
  );

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

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

function isValidClockTime(value: string): boolean {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  if (hour === undefined || minute === undefined) {
    return false;
  }
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function isTimeRangeValid(start: string | null, end: string | null): boolean {
  if (!start || !end) {
    return true;
  }
  return end >= start;
}
