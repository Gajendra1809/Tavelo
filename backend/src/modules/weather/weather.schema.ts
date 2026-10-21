import { z } from 'zod';

export const tripWeatherQuerySchema = z
  .object({
    refresh: z
      .string()
      .trim()
      .optional()
      .transform((value) => value === 'true' || value === '1'),
  })
  .strip();

export type TripWeatherQuery = z.infer<typeof tripWeatherQuerySchema>;
