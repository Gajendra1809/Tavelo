import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const shareSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const expenseSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3, default: 'INR' },
    category: {
      type: String,
      required: true,
      enum: ['food', 'transport', 'lodging', 'activities', 'shopping', 'other'],
    },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expenseDate: { type: Date, required: true },
    splitMethod: { type: String, enum: ['equal', 'custom'], required: true },
    shares: { type: [shareSchema], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

expenseSchema.index({ tripId: 1, expenseDate: -1, createdAt: -1 });

export type ExpenseDocument = InferSchemaType<typeof expenseSchema> & {
  _id: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  paidBy: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ExpenseModel: Model<ExpenseDocument> =
  (mongoose.models.Expense as Model<ExpenseDocument> | undefined) ??
  mongoose.model<ExpenseDocument>('Expense', expenseSchema);
