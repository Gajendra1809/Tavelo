import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'trip_invitation',
  'booking_created',
  'booking_updated',
  'booking_deleted',
  'expense_created',
  'expense_updated',
  'expense_deleted',
  'settlement_recorded',
  'settlement_cancelled',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_ENTITY_TYPES = [
  'invitation',
  'booking',
  'expense',
  'settlement',
] as const;

export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', default: null },
    tripName: { type: String, default: '' },
    entityType: {
      type: String,
      enum: NOTIFICATION_ENTITY_TYPES,
      default: null,
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    entityLabel: { type: String, default: '' },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    readAt: { type: Date, default: null },
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const NotificationModel: Model<NotificationDocument> =
  (mongoose.models.Notification as Model<NotificationDocument> | undefined) ??
  mongoose.model<NotificationDocument>('Notification', notificationSchema);
