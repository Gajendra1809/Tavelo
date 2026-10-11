import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const activitySchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, default: null, trim: true, maxlength: 200 },
    date: { type: Date, required: true },
    startTime: { type: String, default: null, maxlength: 5 },
    endTime: { type: String, default: null, maxlength: 5 },
    notes: { type: String, default: '', maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

activitySchema.index({ tripId: 1, date: 1, startTime: 1, createdAt: 1 });

export type ItineraryActivityDocument = InferSchemaType<typeof activitySchema> & {
  _id: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ItineraryActivityModel: Model<ItineraryActivityDocument> =
  (mongoose.models.ItineraryActivity as Model<ItineraryActivityDocument> | undefined) ??
  mongoose.model<ItineraryActivityDocument>('ItineraryActivity', activitySchema);
