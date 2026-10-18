import { Schema } from 'mongoose';

export const placeMongooseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    formattedAddress: { type: String, default: null, trim: true, maxlength: 500 },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    placeId: { type: String, default: null, trim: true, maxlength: 120 },
    provider: { type: String, default: null, trim: true, maxlength: 40 },
    source: { type: String, enum: ['manual', 'provider'], required: true },
    verified: { type: Boolean, required: true },
  },
  { _id: false },
);

export type PlaceDocument = {
  name: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  provider?: string | null;
  source: 'manual' | 'provider';
  verified: boolean;
};
