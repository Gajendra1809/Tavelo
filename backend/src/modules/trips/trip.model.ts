import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], required: true },
  },
  { _id: false },
);

const tripSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, default: '', maxlength: 500 },
    coverImageUrl: { type: String, default: null, maxlength: 2048 },
    coverObjectKey: { type: String, default: null, maxlength: 512 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

tripSchema.index({ ownerId: 1, startDate: 1, createdAt: 1 });
tripSchema.index({ 'members.userId': 1 });

export type TripDocument = HydratedDocument<InferSchemaType<typeof tripSchema>>;

export const TripModel: Model<TripDocument> =
  (mongoose.models.Trip as Model<TripDocument> | undefined) ??
  mongoose.model<TripDocument>('Trip', tripSchema);
