import type { TaveloPlace } from '@/types/place';

export type ItineraryActivity = {
  id: string;
  tripId: string;
  title: string;
  location: string | null;
  place: TaveloPlace | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type ActivityFormValues = {
  title: string;
  location: string;
  place: TaveloPlace | null;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
};
