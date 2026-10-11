import { createPresignedGetUrl } from '../storage/objectStore';
import { toDateOnly } from '../trips/trip.mapper';
import type { BookingAttachmentDocument, BookingDocument } from './booking.model';

export type BookingCreator = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type BookingAttachmentResponse = {
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
  uploader: BookingCreator;
};

export type BookingResponse = {
  id: string;
  tripId: string;
  title: string;
  category: string;
  provider: string;
  startDate: string;
  endDate: string | null;
  location: string;
  route: string;
  bookingReference: string;
  notes: string;
  timingStatus: 'upcoming' | 'past' | 'ongoing';
  createdBy: BookingCreator;
  attachments: BookingAttachmentResponse[];
  createdAt: string;
  updatedAt: string;
};

export async function toBookingResponse(
  doc: BookingDocument,
  creator: BookingCreator,
  attachmentUploaders: Map<string, BookingCreator>,
): Promise<BookingResponse> {
  const attachments = await Promise.all(
    doc.attachments.map((attachment) =>
      toAttachmentResponse(attachment, attachmentUploaders),
    ),
  );

  return {
    id: doc._id.toString(),
    tripId: doc.tripId.toString(),
    title: doc.title,
    category: doc.category,
    provider: doc.provider ?? '',
    startDate: toDateOnly(doc.startDate),
    endDate: doc.endDate ? toDateOnly(doc.endDate) : null,
    location: doc.location ?? '',
    route: doc.route ?? '',
    bookingReference: doc.bookingReference ?? '',
    notes: doc.notes ?? '',
    timingStatus: deriveTimingStatus(doc),
    createdBy: creator,
    attachments,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function toAttachmentResponse(
  attachment: BookingAttachmentDocument,
  uploaders: Map<string, BookingCreator>,
): Promise<BookingAttachmentResponse> {
  let fileUrl: string | null = null;
  try {
    fileUrl = await createPresignedGetUrl(attachment.objectKey);
  } catch {
    fileUrl = null;
  }
  const mime = attachment.mimeType ?? '';
  return {
    id: attachment._id.toString(),
    objectKey: attachment.objectKey,
    originalFilename: attachment.originalFilename ?? '',
    mimeType: mime,
    byteSize: attachment.byteSize,
    label: attachment.label ?? '',
    uploadedAt: attachment.uploadedAt.toISOString(),
    fileUrl,
    isPdf: mime === 'application/pdf',
    isImage: mime.startsWith('image/'),
    uploader: uploaders.get(attachment.uploadedBy.toString()) ?? {
      id: attachment.uploadedBy.toString(),
      name: 'Traveler',
      avatarUrl: null,
    },
  };
}

function deriveTimingStatus(doc: BookingDocument): 'upcoming' | 'past' | 'ongoing' {
  const today = toDateOnly(new Date());
  const start = toDateOnly(doc.startDate);
  const end = doc.endDate ? toDateOnly(doc.endDate) : start;
  if (today < start) {
    return 'upcoming';
  }
  if (today > end) {
    return 'past';
  }
  return 'ongoing';
}
