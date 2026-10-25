import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const pushDeviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, maxlength: 255 },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    active: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true },
);

pushDeviceSchema.index({ token: 1 }, { unique: true });
pushDeviceSchema.index({ userId: 1, active: 1 });

export type PushDeviceDocument = InferSchemaType<typeof pushDeviceSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PushDeviceModel: Model<PushDeviceDocument> =
  (mongoose.models.PushDevice as Model<PushDeviceDocument> | undefined) ??
  mongoose.model<PushDeviceDocument>('PushDevice', pushDeviceSchema);
