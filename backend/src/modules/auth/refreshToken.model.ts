import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RefreshTokenModel: Model<RefreshTokenDocument> =
  (mongoose.models.RefreshToken as Model<RefreshTokenDocument> | undefined) ??
  mongoose.model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema);
