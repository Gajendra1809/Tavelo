import { z } from 'zod';

const expoPushToken = z
  .string()
  .trim()
  .max(255)
  .regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/, 'Use an Expo push token.');

export const registerPushDeviceSchema = z
  .object({
    token: expoPushToken,
    platform: z.enum(['android', 'ios']).optional().default('android'),
  })
  .strip();

export const deactivatePushDeviceSchema = z
  .object({
    token: expoPushToken,
  })
  .strip();

export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;
export type DeactivatePushDeviceInput = z.infer<typeof deactivatePushDeviceSchema>;
