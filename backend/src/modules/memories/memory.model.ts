import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const memorySchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    objectKey: { type: String, required: true },
    thumbnailObjectKey: { type: String, default: null },
    mimeType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 1 },
    originalFilename: { type: String, default: '', maxlength: 255 },
    caption: { type: String, default: '', maxlength: 500 },
    capturedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

memorySchema.index({ tripId: 1, createdAt: -1 });
memorySchema.index({ tripId: 1, mediaType: 1, createdAt: -1 });

export type MemoryDocument = InferSchemaType<typeof memorySchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const MemoryModel: Model<MemoryDocument> =
  (mongoose.models.TripMemory as Model<MemoryDocument> | undefined) ??
  mongoose.model<MemoryDocument>('TripMemory', memorySchema);
