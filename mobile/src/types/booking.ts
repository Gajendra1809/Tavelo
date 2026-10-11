export const BOOKING_CATEGORIES = [
  'hotel',
  'train',
  'flight',
  'bus',
  'cab',
  'activity',
  'other',
] as const;

export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

export type BookingAttachment = {
  id: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  label: string;
  uploadedAt: string;
  fileUrl: string | null;
  isPdf: boolean;
  isImage: boolean;
  uploader: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

export type TripBooking = {
  id: string;
  tripId: string;
  title: string;
  category: BookingCategory;
  provider: string;
  startDate: string;
  endDate: string | null;
  location: string;
  route: string;
  bookingReference: string;
  notes: string;
  timingStatus: 'upcoming' | 'past' | 'ongoing';
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  attachments: BookingAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type TripBookingsList = {
  bookings: TripBooking[];
  total: number;
};

export type BookingFormValues = {
  title: string;
  category: BookingCategory;
  provider: string;
  startDate: string;
  endDate: string;
  location: string;
  route: string;
  bookingReference: string;
  notes: string;
};
