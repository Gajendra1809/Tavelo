import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const settlementSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3, default: 'INR' },
    status: { type: String, enum: ['recorded', 'cancelled'], default: 'recorded' },
    note: { type: String, default: '', maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

settlementSchema.index({ tripId: 1, createdAt: -1 });

export type SettlementDocument = InferSchemaType<typeof settlementSchema> & {
  _id: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  payerId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SettlementModel: Model<SettlementDocument> =
  (mongoose.models.Settlement as Model<SettlementDocument> | undefined) ??
  mongoose.model<SettlementDocument>('Settlement', settlementSchema);
