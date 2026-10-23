import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const packingItemSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    kind: { type: String, enum: ['group', 'personal'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    packed: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

packingItemSchema.index({ tripId: 1, kind: 1, createdAt: 1 });
packingItemSchema.index({ tripId: 1, kind: 1, userId: 1, createdAt: 1 });

export type PackingItemDocument = HydratedDocument<InferSchemaType<typeof packingItemSchema>>;

export const PackingItemModel: Model<PackingItemDocument> =
  (mongoose.models.PackingItem as Model<PackingItemDocument> | undefined) ??
  mongoose.model<PackingItemDocument>('PackingItem', packingItemSchema);
