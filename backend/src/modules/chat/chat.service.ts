import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { loadUserSummaries, type UserSummary } from '../users/user.service';
import { requireTripMember } from '../trips/trip.service';
import { loadActorName, notifyChatMessage } from '../notifications/notification.service';
import { ChatMessageModel, ChatReadModel, type ChatMessageDocument } from './chat.model';
import { listTypingUserIds, markTyping } from './chat.typing';
import type { CreateMessageInput, ListMessagesQuery, MarkChatReadInput } from './chat.schema';

export type ChatPerson = { id: string; name: string; avatarUrl: string | null };

export type ChatMessageResponse = {
  id: string;
  tripId: string;
  kind: 'text' | 'poll';
  body: string;
  deleted: boolean;
  pollId: string | null;
  sender: ChatPerson;
  createdAt: string;
  clientNonce: string | null;
  mine: boolean;
};

export type ChatReadReceipt = {
  userId: string;
  name: string;
  lastReadMessageId: string;
  lastReadAt: string;
};

export type ChatMessagesPage = {
  messages: ChatMessageResponse[];
  olderCursor: string | null;
  newerCursor: string | null;
  reads: ChatReadReceipt[];
  typing: ChatPerson[];
};

const MAX_MESSAGES_PER_TRIP = 5_000;

type MessageCursor = { createdAt: Date; id: mongoose.Types.ObjectId };

export async function listTripMessages(
  userId: string,
  tripId: string,
  query: ListMessagesQuery,
): Promise<ChatMessagesPage> {
  const trip = await requireTripMember(userId, tripId);
  const before = decodeCursor(query.before);
  const after = decodeCursor(query.after);
  if (query.before && !before) {
    throw new AppError(400, 'VALIDATION_ERROR', 'That page cursor is not valid.');
  }
  if (query.after && !after) {
    throw new AppError(400, 'VALIDATION_ERROR', 'That page cursor is not valid.');
  }

  const filter: Record<string, unknown> = { tripId: trip._id };
  if (before && after) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Use either before or after, not both.');
  }
  if (before) {
    filter.$or = [
      { createdAt: { $lt: before.createdAt } },
      { createdAt: before.createdAt, _id: { $lt: before.id } },
    ];
  }
  if (after) {
    filter.$or = [
      { createdAt: { $gt: after.createdAt } },
      { createdAt: after.createdAt, _id: { $gt: after.id } },
    ];
  }

  const docs = await ChatMessageModel.find(filter)
    .sort(after ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean();

  const hasMore = docs.length > query.limit;
  const page = docs.slice(0, query.limit);
  if (!after) {
    page.reverse();
  }

  const senderIds = page.map((row) => row.senderId.toString());
  const readDocs = await ChatReadModel.find({ tripId: trip._id }).lean();
  const readUserIds = readDocs.map((row) => row.userId.toString());
  const typingIds = listTypingUserIds(trip._id.toString(), userId);
  const profiles = await loadUserSummaries([...senderIds, ...readUserIds, ...typingIds]);

  const messages = page.map((row) => toMessageResponse(row, userId, profiles));
  const oldest = messages[0];
  const newest = messages.at(-1);

  if (newest && !after) {
    await rememberRead(trip._id, userId, newest.id);
  }

  return {
    messages,
    olderCursor:
      !after && hasMore && oldest
        ? encodeCursor({ createdAt: new Date(oldest.createdAt), id: new mongoose.Types.ObjectId(oldest.id) })
        : null,
    newerCursor: newest
      ? encodeCursor({ createdAt: new Date(newest.createdAt), id: new mongoose.Types.ObjectId(newest.id) })
      : null,
    reads: readDocs
      .filter((row) => row.userId.toString() !== userId)
      .map((row) => ({
        userId: row.userId.toString(),
        name: profiles.get(row.userId.toString())?.name ?? 'Traveler',
        lastReadMessageId: row.lastReadMessageId.toString(),
        lastReadAt: row.lastReadAt.toISOString(),
      })),
    typing: typingIds.map((id) => ({
      id,
      name: profiles.get(id)?.name ?? 'Traveler',
      avatarUrl: profiles.get(id)?.avatarUrl ?? null,
    })),
  };
}

export async function createTripMessage(
  userId: string,
  tripId: string,
  input: CreateMessageInput,
): Promise<ChatMessageResponse> {
  const trip = await requireTripMember(userId, tripId);
  if (input.clientNonce) {
    const existing = await ChatMessageModel.findOne({
      tripId: trip._id,
      senderId: userId,
      clientNonce: input.clientNonce,
    });
    if (existing) {
      const profiles = await loadUserSummaries([userId]);
      return toMessageResponse(existing, userId, profiles);
    }
  }

  const count = await ChatMessageModel.countDocuments({ tripId: trip._id });
  if (count >= MAX_MESSAGES_PER_TRIP) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This trip chat is full.');
  }

  try {
    const created = await ChatMessageModel.create({
      tripId: trip._id,
      senderId: userId,
      kind: 'text',
      body: input.body,
      pollId: null,
      clientNonce: input.clientNonce ?? null,
      deletedAt: null,
    });
    const profiles = await loadUserSummaries([userId]);
    const actorName = profiles.get(userId)?.name ?? (await loadActorName(userId));
    await notifyChatMessage({
      actorId: userId,
      actorName,
      trip,
      messageId: created._id.toString(),
      preview: input.body,
    });
    await rememberRead(trip._id, userId, created._id.toString());
    return toMessageResponse(created, userId, profiles);
  } catch (error) {
    if (isDuplicateKey(error) && input.clientNonce) {
      const existing = await ChatMessageModel.findOne({
        tripId: trip._id,
        senderId: userId,
        clientNonce: input.clientNonce,
      });
      if (existing) {
        const profiles = await loadUserSummaries([userId]);
        return toMessageResponse(existing, userId, profiles);
      }
    }
    throw error;
  }
}

export async function deleteTripMessage(
  userId: string,
  tripId: string,
  messageId: string,
): Promise<void> {
  const trip = await requireTripMember(userId, tripId);
  if (!mongoose.isValidObjectId(messageId)) {
    throw new AppError(404, 'NOT_FOUND', 'Message not found.');
  }
  const message = await ChatMessageModel.findOne({ _id: messageId, tripId: trip._id });
  if (!message) {
    throw new AppError(404, 'NOT_FOUND', 'Message not found.');
  }
  if (message.senderId.toString() !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own messages.');
  }
  if (message.kind !== 'text') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Poll cards are removed by deleting the poll.');
  }
  if (message.deletedAt) {
    return;
  }
  message.deletedAt = new Date();
  await message.save();
}

export async function markTripChatRead(
  userId: string,
  tripId: string,
  input: MarkChatReadInput,
): Promise<{ updated: boolean }> {
  const trip = await requireTripMember(userId, tripId);
  const message = await ChatMessageModel.findOne({ _id: input.messageId, tripId: trip._id }).select('_id');
  if (!message) {
    throw new AppError(404, 'NOT_FOUND', 'Message not found.');
  }
  await rememberRead(trip._id, userId, message._id.toString());
  return { updated: true };
}

export async function markTripChatTyping(userId: string, tripId: string): Promise<{ typing: boolean }> {
  const trip = await requireTripMember(userId, tripId);
  markTyping(trip._id.toString(), userId);
  return { typing: true };
}

export async function createPollChatMessage(input: {
  tripId: mongoose.Types.ObjectId;
  senderId: string;
  pollId: mongoose.Types.ObjectId;
  question: string;
}): Promise<ChatMessageDocument> {
  return ChatMessageModel.create({
    tripId: input.tripId,
    senderId: input.senderId,
    kind: 'poll',
    body: input.question,
    pollId: input.pollId,
    clientNonce: null,
    deletedAt: null,
  });
}

export async function deleteChatForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  await ChatMessageModel.deleteMany({ tripId });
  await ChatReadModel.deleteMany({ tripId });
}

function toMessageResponse(
  row: {
    _id: mongoose.Types.ObjectId;
    tripId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    kind: 'text' | 'poll';
    body: string;
    pollId?: mongoose.Types.ObjectId | null;
    clientNonce?: string | null;
    deletedAt?: Date | null;
    createdAt: Date;
  },
  viewerId: string,
  profiles: Map<string, UserSummary>,
): ChatMessageResponse {
  const senderId = row.senderId.toString();
  const deleted = Boolean(row.deletedAt);
  const profile = profiles.get(senderId);
  return {
    id: row._id.toString(),
    tripId: row.tripId.toString(),
    kind: row.kind,
    body: deleted ? '' : row.body,
    deleted,
    pollId: row.pollId ? row.pollId.toString() : null,
    sender: {
      id: senderId,
      name: profile?.name ?? 'Traveler',
      avatarUrl: profile?.avatarUrl ?? null,
    },
    createdAt: row.createdAt.toISOString(),
    clientNonce: row.clientNonce ?? null,
    mine: senderId === viewerId,
  };
}

async function rememberRead(
  tripId: mongoose.Types.ObjectId,
  userId: string,
  messageId: string,
): Promise<void> {
  await ChatReadModel.findOneAndUpdate(
    { tripId, userId },
    {
      $set: {
        lastReadMessageId: new mongoose.Types.ObjectId(messageId),
        lastReadAt: new Date(),
      },
    },
    { upsert: true },
  );
}

function decodeCursor(raw: string | undefined): MessageCursor | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      c?: string;
      i?: string;
    };
    if (!parsed.c || !parsed.i || !mongoose.isValidObjectId(parsed.i)) {
      return null;
    }
    return { createdAt: new Date(parsed.c), id: new mongoose.Types.ObjectId(parsed.i) };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: MessageCursor): string {
  return Buffer.from(
    JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id.toString() }),
  ).toString('base64url');
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

