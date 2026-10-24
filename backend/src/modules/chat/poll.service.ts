import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { loadUserSummaries, type UserSummary } from '../users/user.service';
import { requireTripMember } from '../trips/trip.service';
import { loadActorName, notifyPollEvent, tripMemberUserIds } from '../notifications/notification.service';
import { createPollChatMessage } from './chat.service';
import {
  PollVoteModel,
  TripPollModel,
  type PollCategory,
  type TripPollDocument,
} from './poll.model';
import type {
  AddPollOptionInput,
  CreatePollInput,
  UpdatePollInput,
  VotePollInput,
} from './poll.schema';

export type PollPerson = { id: string; name: string; avatarUrl: string | null };

export type PollOptionResponse = {
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

export type PollResponse = {
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
  options: PollOptionResponse[];
  ownOptionIds: string[];
  result: PollResult;
  canVote: boolean;
  canClose: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAddOption: boolean;
};

const MAX_POLLS_PER_TRIP = 50;
const MAX_OPTIONS = 10;

export async function listTripPolls(userId: string, tripId: string): Promise<{ polls: PollResponse[] }> {
  const trip = await requireTripMember(userId, tripId);
  const polls = await TripPollModel.find({ tripId: trip._id }).sort({ createdAt: -1 });
  const mapped = await mapPolls(polls, userId, tripMemberUserIds(trip).length);
  return { polls: mapped };
}

export async function getTripPoll(userId: string, tripId: string, pollId: string): Promise<PollResponse> {
  const { trip, poll } = await findTripPoll(userId, tripId, pollId);
  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  if (!mapped) {
    throw new AppError(404, 'NOT_FOUND', 'Poll not found.');
  }
  return mapped;
}

export async function createTripPoll(
  userId: string,
  tripId: string,
  input: CreatePollInput,
): Promise<PollResponse> {
  const trip = await requireTripMember(userId, tripId);
  const existingCount = await TripPollModel.countDocuments({ tripId: trip._id });
  if (existingCount >= MAX_POLLS_PER_TRIP) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This trip already has the maximum number of polls.');
  }
  const deadlineAt = parseDeadline(input.deadlineAt, true);
  const poll = await TripPollModel.create({
    tripId: trip._id,
    creatorId: userId,
    question: input.question,
    description: input.description ?? '',
    category: input.category,
    voteType: input.voteType,
    maxChoices: input.voteType === 'multiple' ? (input.maxChoices ?? null) : null,
    anonymous: input.anonymous,
    allowAddOptions: input.allowAddOptions,
    deadlineAt,
    status: 'open',
    options: input.options.map((option) => ({
      label: option.label,
      description: option.description ?? '',
      imageUrl: option.imageUrl ?? null,
      linkUrl: option.linkUrl ?? null,
      addedBy: userId,
    })),
  });

  const message = await createPollChatMessage({
    tripId: trip._id,
    senderId: userId,
    pollId: poll._id,
    question: poll.question,
  });
  poll.messageId = message._id;
  await poll.save();

  const actorName = await loadActorName(userId);
  await notifyPollEvent({
    actorId: userId,
    actorName,
    trip,
    pollId: poll._id.toString(),
    question: poll.question,
    kind: 'poll_created',
  });

  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  return mapped!;
}

export async function updateTripPoll(
  userId: string,
  tripId: string,
  pollId: string,
  input: UpdatePollInput,
): Promise<PollResponse> {
  const { trip, poll } = await findTripPoll(userId, tripId, pollId);
  assertCreator(poll, userId);
  if (effectiveStatus(poll) !== 'open') {
    throw new AppError(409, 'CONFLICT', 'Closed or expired polls cannot be edited.');
  }
  if (input.question !== undefined) {
    poll.question = input.question;
  }
  if (input.description !== undefined) {
    poll.description = input.description;
  }
  if (input.allowAddOptions !== undefined) {
    poll.allowAddOptions = input.allowAddOptions;
  }
  if (input.deadlineAt !== undefined) {
    poll.deadlineAt = parseDeadline(input.deadlineAt, false);
  }
  await poll.save();
  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  return mapped!;
}

export async function addTripPollOption(
  userId: string,
  tripId: string,
  pollId: string,
  input: AddPollOptionInput,
): Promise<PollResponse> {
  const { trip, poll } = await findTripPoll(userId, tripId, pollId);
  if (effectiveStatus(poll) !== 'open') {
    throw new AppError(409, 'CONFLICT', 'This poll is no longer open.');
  }
  if (!poll.allowAddOptions) {
    throw new AppError(403, 'FORBIDDEN', 'This poll does not allow new options.');
  }
  if (poll.options.length >= MAX_OPTIONS) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This poll already has 10 options.');
  }
  const label = input.label.toLowerCase();
  if (poll.options.some((option) => option.label.toLowerCase() === label)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'That option is already on this poll.');
  }
  poll.options.push({
    label: input.label,
    description: input.description ?? '',
    imageUrl: input.imageUrl ?? null,
    linkUrl: input.linkUrl ?? null,
    addedBy: userId,
  });
  await poll.save();
  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  return mapped!;
}

export async function voteTripPoll(
  userId: string,
  tripId: string,
  pollId: string,
  input: VotePollInput,
): Promise<PollResponse> {
  const { trip, poll } = await findTripPoll(userId, tripId, pollId);
  assertPollAcceptsVotes(poll);
  const optionIds = uniqueObjectIds(input.optionIds);
  const valid = new Set(poll.options.map((option) => option._id.toString()));
  if (optionIds.some((id) => !valid.has(id))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'One of those options is not on this poll.');
  }
  if (poll.voteType === 'single' && optionIds.length !== 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Choose one option.');
  }
  const maxChoices = poll.maxChoices ?? poll.options.length;
  if (poll.voteType === 'multiple' && optionIds.length > maxChoices) {
    throw new AppError(400, 'VALIDATION_ERROR', `Choose up to ${maxChoices} options.`);
  }

  await PollVoteModel.findOneAndUpdate(
    { pollId: poll._id, userId },
    {
      $set: {
        tripId: trip._id,
        optionIds: optionIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    },
    { upsert: true },
  );

  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  return mapped!;
}

export async function removeTripPollVote(
  userId: string,
  tripId: string,
  pollId: string,
): Promise<PollResponse> {
  const { trip, poll } = await findTripPoll(userId, tripId, pollId);
  assertPollAcceptsVotes(poll);
  await PollVoteModel.deleteOne({ pollId: poll._id, userId });
  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  return mapped!;
}

export async function closeTripPoll(userId: string, tripId: string, pollId: string): Promise<PollResponse> {
  const { trip, poll } = await findTripPoll(userId, tripId, pollId);
  assertCreator(poll, userId);
  if (poll.status === 'closed') {
    const [already] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
    return already!;
  }
  poll.status = 'closed';
  poll.closedAt = new Date();
  poll.closedBy = new mongoose.Types.ObjectId(userId);
  await poll.save();
  const actorName = await loadActorName(userId);
  await notifyPollEvent({
    actorId: userId,
    actorName,
    trip,
    pollId: poll._id.toString(),
    question: poll.question,
    kind: 'poll_closed',
  });
  const [mapped] = await mapPolls([poll], userId, tripMemberUserIds(trip).length);
  return mapped!;
}

export async function deleteTripPoll(userId: string, tripId: string, pollId: string): Promise<void> {
  const { poll } = await findTripPoll(userId, tripId, pollId);
  assertCreator(poll, userId);
  if (poll.finalizedAt) {
    throw new AppError(409, 'CONFLICT', 'A finalized poll cannot be deleted.');
  }
  const { ChatMessageModel } = await import('./chat.model');
  await ChatMessageModel.deleteOne({ _id: poll.messageId ?? undefined, kind: 'poll' });
  await PollVoteModel.deleteMany({ pollId: poll._id });
  await TripPollModel.deleteOne({ _id: poll._id });
}

export async function deletePollsForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  await PollVoteModel.deleteMany({ tripId });
  await TripPollModel.deleteMany({ tripId });
}

export async function loadPollsByIds(
  userId: string,
  tripId: string,
  pollIds: string[],
): Promise<Map<string, PollResponse>> {
  if (pollIds.length === 0) {
    return new Map();
  }
  const trip = await requireTripMember(userId, tripId);
  const unique = [...new Set(pollIds.filter((id) => mongoose.isValidObjectId(id)))];
  const polls = await TripPollModel.find({
    tripId: trip._id,
    _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  const mapped = await mapPolls(polls, userId, tripMemberUserIds(trip).length);
  return new Map(mapped.map((poll) => [poll.id, poll]));
}

async function findTripPoll(userId: string, tripId: string, pollId: string) {
  const trip = await requireTripMember(userId, tripId);
  if (!mongoose.isValidObjectId(pollId)) {
    throw new AppError(404, 'NOT_FOUND', 'Poll not found.');
  }
  const poll = await TripPollModel.findOne({ _id: pollId, tripId: trip._id });
  if (!poll) {
    throw new AppError(404, 'NOT_FOUND', 'Poll not found.');
  }
  return { trip, poll };
}

async function mapPolls(
  polls: TripPollDocument[],
  viewerId: string,
  memberCount: number,
): Promise<PollResponse[]> {
  if (polls.length === 0) {
    return [];
  }
  const pollIds = polls.map((poll) => poll._id);
  const votes = await PollVoteModel.find({ pollId: { $in: pollIds } }).lean();
  const votesByPoll = new Map<string, typeof votes>();
  const profileIds = new Set<string>();
  for (const poll of polls) {
    profileIds.add(poll.creatorId.toString());
  }
  for (const vote of votes) {
    const key = vote.pollId.toString();
    const list = votesByPoll.get(key) ?? [];
    list.push(vote);
    votesByPoll.set(key, list);
    profileIds.add(vote.userId.toString());
  }
  const profiles = await loadUserSummaries([...profileIds]);

  return polls.map((poll) => {
    const pollVotes = votesByPoll.get(poll._id.toString()) ?? [];
    return toPollResponse(poll, pollVotes, viewerId, memberCount, profiles);
  });
}

function toPollResponse(
  poll: TripPollDocument,
  votes: { userId: mongoose.Types.ObjectId; optionIds: mongoose.Types.ObjectId[] }[],
  viewerId: string,
  memberCount: number,
  profiles: Map<string, UserSummary>,
): PollResponse {
  const status = effectiveStatus(poll);
  const counts = new Map<string, string[]>();
  for (const option of poll.options) {
    counts.set(option._id.toString(), []);
  }
  for (const vote of votes) {
    for (const optionId of vote.optionIds) {
      const key = optionId.toString();
      const voters = counts.get(key);
      if (voters) {
        voters.push(vote.userId.toString());
      }
    }
  }
  const totalVotes = votes.length;
  const own = votes.find((vote) => vote.userId.toString() === viewerId);
  const ownOptionIds = own ? own.optionIds.map((id) => id.toString()) : [];
  const options: PollOptionResponse[] = poll.options.map((option) => {
    const voterIds = counts.get(option._id.toString()) ?? [];
    return {
      id: option._id.toString(),
      label: option.label,
      description: option.description ?? '',
      imageUrl: option.imageUrl ?? null,
      linkUrl: option.linkUrl ?? null,
      voteCount: voterIds.length,
      percent: totalVotes === 0 ? 0 : Math.round((voterIds.length / totalVotes) * 100),
      voters: poll.anonymous
        ? null
        : voterIds.map((id) => ({
            id,
            name: profiles.get(id)?.name ?? 'Traveler',
            avatarUrl: profiles.get(id)?.avatarUrl ?? null,
          })),
    };
  });
  const result = computeResult(options);
  const creatorId = poll.creatorId.toString();
  const creatorProfile = profiles.get(creatorId);
  const isCreator = creatorId === viewerId;
  const open = status === 'open';

  return {
    id: poll._id.toString(),
    tripId: poll.tripId.toString(),
    question: poll.question,
    description: poll.description ?? '',
    category: poll.category,
    voteType: poll.voteType,
    maxChoices: poll.maxChoices ?? null,
    anonymous: poll.anonymous,
    allowAddOptions: poll.allowAddOptions,
    deadlineAt: poll.deadlineAt ? poll.deadlineAt.toISOString() : null,
    status,
    closedAt: poll.closedAt ? poll.closedAt.toISOString() : null,
    creator: {
      id: creatorId,
      name: creatorProfile?.name ?? 'Traveler',
      avatarUrl: creatorProfile?.avatarUrl ?? null,
    },
    createdAt: poll.createdAt.toISOString(),
    messageId: poll.messageId ? poll.messageId.toString() : null,
    memberCount,
    votedCount: totalVotes,
    options,
    ownOptionIds,
    result,
    canVote: open,
    canClose: open && isCreator,
    canEdit: open && isCreator,
    canDelete: isCreator && !poll.finalizedAt,
    canAddOption: open && poll.allowAddOptions,
  };
}

function computeResult(options: PollOptionResponse[]): PollResult {
  let top = 0;
  for (const option of options) {
    if (option.voteCount > top) {
      top = option.voteCount;
    }
  }
  if (top === 0) {
    return { kind: 'none', optionIds: [], voteCount: 0 };
  }
  const optionIds = options.filter((option) => option.voteCount === top).map((option) => option.id);
  return {
    kind: optionIds.length === 1 ? 'winner' : 'tie',
    optionIds,
    voteCount: top,
  };
}

function effectiveStatus(poll: TripPollDocument): 'open' | 'closed' | 'expired' {
  if (poll.status === 'closed') {
    return 'closed';
  }
  if (poll.deadlineAt && poll.deadlineAt.getTime() <= Date.now()) {
    return 'expired';
  }
  return 'open';
}

function assertPollAcceptsVotes(poll: TripPollDocument): void {
  const status = effectiveStatus(poll);
  if (status === 'closed') {
    throw new AppError(409, 'CONFLICT', 'This poll is closed.');
  }
  if (status === 'expired') {
    throw new AppError(409, 'CONFLICT', 'This poll has expired.');
  }
}

function assertCreator(poll: TripPollDocument, userId: string): void {
  if (poll.creatorId.toString() !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the poll creator can do that.');
  }
}

function parseDeadline(value: string | null | undefined, requireFuture: boolean): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Use a valid deadline.');
  }
  if (requireFuture && date.getTime() <= Date.now()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Choose a deadline in the future.');
  }
  return date;
}

function uniqueObjectIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
