import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** Lowercase normalized handle; unique when set. Legacy users may be null until they choose one. */
    username: { type: String, default: null, trim: true, lowercase: true, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    avatarObjectKey: { type: String, default: null, maxlength: 512 },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ name: 1 });

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const UserModel: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>('User', userSchema);
