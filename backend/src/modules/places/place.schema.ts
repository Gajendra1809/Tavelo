import { z } from 'zod';

const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);

export const taveloPlaceSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a place name.').max(200, 'Use 200 characters or fewer.'),
    formattedAddress: z
      .string()
      .trim()
      .max(500, 'Use 500 characters or fewer.')
      .optional()
      .nullable()
      .transform((value) => (value && value.length > 0 ? value : null)),
    latitude: latitudeSchema.nullable().optional().default(null),
    longitude: longitudeSchema.nullable().optional().default(null),
    placeId: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((value) => (value && value.length > 0 ? value : null)),
    provider: z
      .string()
      .trim()
      .max(40)
      .optional()
      .nullable()
      .transform((value) => (value && value.length > 0 ? value : null)),
    source: z.enum(['manual', 'provider']),
    verified: z.boolean(),
  })
  .strip()
  .superRefine((place, ctx) => {
    const hasLat = place.latitude !== null && place.latitude !== undefined;
    const hasLng = place.longitude !== null && place.longitude !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'Latitude and longitude must be stored together.',
        path: hasLat ? ['longitude'] : ['latitude'],
      });
    }
    if (place.verified && (!hasLat || !hasLng)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Verified places require coordinates.',
        path: ['verified'],
      });
    }
    if (place.source === 'provider' && place.verified && !place.provider) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provider places must include a provider id.',
        path: ['provider'],
      });
    }
  });

export type TaveloPlaceInput = z.infer<typeof taveloPlaceSchema>;

export const nullableTaveloPlaceSchema = z.union([taveloPlaceSchema, z.null()]);

export type PlaceSearchQuery = z.infer<typeof placeSearchQuerySchema>;

export const placeSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2, 'Enter at least 2 characters.').max(100, 'Use 100 characters or fewer.'),
    limit: z
      .string()
      .trim()
      .optional()
      .transform((value) => Number(value === undefined || value === '' ? '8' : value))
      .pipe(z.number().int().min(1).max(10)),
  })
  .strip();

export type PlaceSearchResult = {
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  provider: 'nominatim';
};
