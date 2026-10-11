import { z } from 'zod';
import { BOOKING_CATEGORIES } from './booking.model';

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.');

export const bookingCategorySchema = z.enum(BOOKING_CATEGORIES);

const bookingFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Enter a booking title.').max(200),
  category: bookingCategorySchema,
  provider: z.string().trim().max(200).optional().default(''),
  startDate: dateOnly,
  endDate: dateOnly.optional(),
  location: z.string().trim().max(300).optional().default(''),
  route: z.string().trim().max(300).optional().default(''),
  bookingReference: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(4000).optional().default(''),
});

function refineBookingDates<T extends { startDate?: string; endDate?: string }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'End date cannot be before start date.',
      path: ['endDate'],
    });
  }
}

export const createBookingSchema = bookingFieldsSchema.superRefine(refineBookingDates);

export const updateBookingSchema = bookingFieldsSchema.partial().superRefine(refineBookingDates);

export const listBookingsQuerySchema = z.object({
  category: bookingCategorySchema.optional(),
});

export const bookingAttachmentUploadIntentSchema = z.object({
  contentType: z.string().trim().min(1),
  byteSize: z.number().int().positive(),
  originalFilename: z.string().trim().max(255).optional(),
  label: z.string().trim().max(120).optional(),
});

export const completeBookingAttachmentSchema = z.object({
  objectKey: z.string().trim().min(1),
  originalFilename: z.string().trim().max(255).optional(),
  label: z.string().trim().max(120).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
export type BookingAttachmentUploadIntentInput = z.infer<
  typeof bookingAttachmentUploadIntentSchema
>;
export type CompleteBookingAttachmentInput = z.infer<typeof completeBookingAttachmentSchema>;
