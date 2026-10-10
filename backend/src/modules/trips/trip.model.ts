import mongoose, { Schema } from 'mongoose';

const tripSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

tripSchema.index({ startDate: 1, createdAt: 1 });

export const TripModel = mongoose.models.Trip ?? mongoose.model('Trip', tripSchema);
