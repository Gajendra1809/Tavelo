import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const invitationSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      required: true,
      default: 'pending',
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

invitationSchema.index(
  { tripId: 1, inviteeId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
invitationSchema.index({ inviteeId: 1, status: 1, createdAt: -1 });
invitationSchema.index({ tripId: 1, createdAt: -1 });

export type InvitationDocument = InferSchemaType<typeof invitationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const InvitationModel: Model<InvitationDocument> =
  (mongoose.models.Invitation as Model<InvitationDocument> | undefined) ??
  mongoose.model<InvitationDocument>('Invitation', invitationSchema);
