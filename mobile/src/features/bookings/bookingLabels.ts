import type { BookingCategory } from '@/types/booking';

export const categoryLabel: Record<BookingCategory, string> = {
  hotel: 'Hotel',
  train: 'Train',
  flight: 'Flight',
  bus: 'Bus',
  cab: 'Cab',
  activity: 'Activity',
  other: 'Other',
};

export const categorySymbol = {
  hotel: { android: 'hotel', web: 'hotel' },
  train: { android: 'train', web: 'train' },
  flight: { android: 'flight', web: 'flight' },
  bus: { android: 'directions_bus', web: 'directions_bus' },
  cab: { android: 'local_taxi', web: 'local_taxi' },
  activity: { android: 'local_activity', web: 'local_activity' },
  other: { android: 'confirmation_number', web: 'confirmation_number' },
} as const satisfies Record<BookingCategory, { android: string; web: string }>;
