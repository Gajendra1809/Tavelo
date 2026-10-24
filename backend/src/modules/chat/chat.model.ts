import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

export const CHAT_MESSAGE_KINDS = ['text', 'poll'] as const;
export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];

const chatMessageSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: CHAT_MESSAGE_KINDS, required: true, default: 'text' },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    pollId: { type: Schema.Types.ObjectId, ref: 'TripPoll', default: null },
    clientNonce: { type: String, default: null, maxlength: 64 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

chatMessageSchema.index({ tripId: 1, createdAt: -1, _id: -1 });
chatMessageSchema.index({ tripId: 1, pollId: 1 });
chatMessageSchema.index(
  { tripId: 1, senderId: 1, clientNonce: 1 },
  { unique: true, partialFilterExpression: { clientNonce: { $type: 'string' } } },
);

const chatReadSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'ChatMessage', required: true },
    lastReadAt: { type: Date, required: true },
  },
  { timestamps: false },
);

chatReadSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export type ChatMessageDocument = HydratedDocument<InferSchemaType<typeof chatMessageSchema>>;
export type ChatReadDocument = HydratedDocument<InferSchemaType<typeof chatReadSchema>>;

export const ChatMessageModel: Model<ChatMessageDocument> =
  (mongoose.models.ChatMessage as Model<ChatMessageDocument> | undefined) ??
  mongoose.model<ChatMessageDocument>('ChatMessage', chatMessageSchema);

export const ChatReadModel: Model<ChatReadDocument> =
  (mongoose.models.ChatRead as Model<ChatReadDocument> | undefined) ??
  mongoose.model<ChatReadDocument>('ChatRead', chatReadSchema);
