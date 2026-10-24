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

export const POLL_CATEGORY_LABELS: Record<PollCategory, string> = {
  destination: 'Destination',
  hotel: 'Hotel / stay',
  restaurant: 'Restaurant',
  activity: 'Activities',
  transport: 'Transport',
  dates: 'Trip dates',
  other: 'Other',
};

export type PollPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type PollOption = {
  id: string;
  label: string;
  description: string;
  imageUrl: string | null;
  linkUrl: string | null;
  voteCount: number;
  percent: number;
  voters: PollPerson[] | null;
};

export type PollResult = {
  kind: 'none' | 'winner' | 'tie';
  optionIds: string[];
  voteCount: number;
};

export type TripPoll = {
  id: string;
  tripId: string;
  question: string;
  description: string;
  category: PollCategory;
  voteType: 'single' | 'multiple';
  maxChoices: number | null;
  anonymous: boolean;
  allowAddOptions: boolean;
  deadlineAt: string | null;
  status: 'open' | 'closed' | 'expired';
  closedAt: string | null;
  creator: PollPerson;
  createdAt: string;
  messageId: string | null;
  memberCount: number;
  votedCount: number;
  options: PollOption[];
  ownOptionIds: string[];
  result: PollResult;
  canVote: boolean;
  canClose: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAddOption: boolean;
};

export type CreatePollBody = {
  question: string;
  description?: string;
  category?: PollCategory;
  voteType?: 'single' | 'multiple';
  maxChoices?: number | null;
  anonymous?: boolean;
  allowAddOptions?: boolean;
  deadlineAt?: string | null;
  options: { label: string; description?: string; imageUrl?: string | null; linkUrl?: string | null }[];
};
