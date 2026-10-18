import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { placeMongooseSchema } from '../places/place.model';

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

const attachmentSchema = new Schema(
  {
    objectKey: { type: String, required: true },
    originalFilename: { type: String, default: '' },
    mimeType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 1 },
    label: { type: String, default: '' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

const bookingSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: BOOKING_CATEGORIES },
    provider: { type: String, default: '', trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    location: { type: String, default: '', trim: true },
    place: { type: placeMongooseSchema, default: null },
    route: { type: String, default: '', trim: true },
    bookingReference: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true },
);

bookingSchema.index({ tripId: 1, startDate: 1, _id: 1 });

export type BookingAttachmentDocument = InferSchemaType<typeof attachmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type BookingDocument = HydratedDocument<InferSchemaType<typeof bookingSchema>>;

export const BookingModel: Model<BookingDocument> =
  (mongoose.models.Booking as Model<BookingDocument> | undefined) ??
  mongoose.model<BookingDocument>('Booking', bookingSchema);
