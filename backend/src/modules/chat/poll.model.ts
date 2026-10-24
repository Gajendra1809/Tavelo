import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

export const POLL_CATEGORIES = [
  'destination',
  'hotel',
  'restaurant',
  'activity',
  'transport',
  'dates',
  'other',
] as const;

export type PollCategory = (typeof POLL_CATEGORIES)[number];

export const POLL_VOTE_TYPES = ['single', 'multiple'] as const;
export type PollVoteType = (typeof POLL_VOTE_TYPES)[number];

export const POLL_STATUSES = ['open', 'closed'] as const;
export type PollStatus = (typeof POLL_STATUSES)[number];

const pollOptionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    imageUrl: { type: String, default: null, maxlength: 500 },
    linkUrl: { type: String, default: null, maxlength: 500 },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

const pollSchema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    category: { type: String, enum: POLL_CATEGORIES, required: true, default: 'other' },
    voteType: { type: String, enum: POLL_VOTE_TYPES, required: true, default: 'single' },
    maxChoices: { type: Number, default: null, min: 2, max: 10 },
    anonymous: { type: Boolean, required: true, default: false },
    allowAddOptions: { type: Boolean, required: true, default: false },
    deadlineAt: { type: Date, default: null },
    status: { type: String, enum: POLL_STATUSES, required: true, default: 'open' },
    closedAt: { type: Date, default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    options: { type: [pollOptionSchema], required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
    // Leftover from a removed "add poll to itinerary/booking" action. Not written anymore.
    finalizedAt: { type: Date, default: null },
    finalizedOptionId: { type: Schema.Types.ObjectId, default: null },
    finalizedTargetKind: { type: String, enum: ['activity', 'booking'], default: null },
    finalizedTargetId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

pollSchema.index({ tripId: 1, createdAt: -1 });
pollSchema.index({ tripId: 1, status: 1, deadlineAt: 1 });

const pollVoteSchema = new Schema(
  {
    pollId: { type: Schema.Types.ObjectId, ref: 'TripPoll', required: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    optionIds: { type: [Schema.Types.ObjectId], required: true },
  },
  { timestamps: true },
);

pollVoteSchema.index({ pollId: 1, userId: 1 }, { unique: true });
pollVoteSchema.index({ tripId: 1, pollId: 1 });

export type TripPollDocument = HydratedDocument<InferSchemaType<typeof pollSchema>>;
export type PollVoteDocument = HydratedDocument<InferSchemaType<typeof pollVoteSchema>>;

export const TripPollModel: Model<TripPollDocument> =
  (mongoose.models.TripPoll as Model<TripPollDocument> | undefined) ??
  mongoose.model<TripPollDocument>('TripPoll', pollSchema);

export const PollVoteModel: Model<PollVoteDocument> =
  (mongoose.models.PollVote as Model<PollVoteDocument> | undefined) ??
  mongoose.model<PollVoteDocument>('PollVote', pollVoteSchema);
