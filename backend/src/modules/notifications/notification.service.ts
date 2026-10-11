import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { loadUserSummaries } from '../users/user.service';
import type { TripDocument } from '../trips/trip.model';
import {
  NotificationModel,
  type NotificationEntityType,
  type NotificationType,
} from './notification.model';
import { toNotificationResponse, type NotificationResponse } from './notification.mapper';
import type { ListNotificationsQuery } from './notification.schema';

type CreateNotificationInput = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  message: string;
  tripId?: string;
  tripName?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  entityLabel?: string;
  idempotencyKey?: string;
};

type NotificationCursor = { createdAt: Date; id: mongoose.Types.ObjectId };

export async function listNotificationsForUser(
  userId: string,
  query: ListNotificationsQuery,
): Promise<{ notifications: NotificationResponse[]; nextCursor: string | null }> {
  assertDatabaseConnected();
  const cursor = decodeCursor(query.cursor);
  const filter = cursor
    ? {
        recipientId: userId,
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      }
    : { recipientId: userId };

  const docs = await NotificationModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1);

  const page = docs.slice(0, query.limit);
  const hasMore = docs.length > query.limit;
  const actorIds = page.map((row) => row.actorId.toString());
  const profiles = await loadUserSummaries(actorIds);

  const notifications = page.map((doc) => {
    const actorId = doc.actorId.toString();
    const actor = profiles.get(actorId) ?? {
      name: 'Traveler',
      avatarUrl: null,
    };
    return toNotificationResponse(doc, actorId, actor);
  });

  const last = page.at(-1);
  return {
    notifications,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last._id }) : null,
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  assertDatabaseConnected();
  return NotificationModel.countDocuments({ recipientId: userId, readAt: null });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationResponse> {
  assertDatabaseConnected();
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  }
  const doc = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!doc) {
    const exists = await NotificationModel.exists({ _id: notificationId });
    if (!exists) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
    }
    throw new AppError(403, 'FORBIDDEN', 'You cannot update this notification.');
  }
  const actorId = doc.actorId.toString();
  const actor =
    (await loadUserSummaries([actorId])).get(actorId) ?? {
      name: 'Traveler',
      avatarUrl: null,
    };
  return toNotificationResponse(doc, actorId, actor);
}

export async function markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
  assertDatabaseConnected();
  const result = await NotificationModel.updateMany(
    { recipientId: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { updated: result.modifiedCount };
}

export function tripMemberUserIds(trip: TripDocument): string[] {
  const ids = new Set<string>();
  ids.add(trip.ownerId.toString());
  for (const member of trip.members ?? []) {
    ids.add(member.userId.toString());
  }
  return [...ids];
}

export function involvedUserIdsFromExpense(expense: {
  paidBy: { toString(): string };
  shares: { userId: { toString(): string } }[];
}): string[] {
  const ids = new Set<string>();
  ids.add(expense.paidBy.toString());
  for (const share of expense.shares) {
    ids.add(share.userId.toString());
  }
  return [...ids];
}

export async function notifyTripInvitation(input: {
  inviteeId: string;
  actorId: string;
  invitationId: string;
  tripId: string;
  tripName: string;
  actorName: string;
}): Promise<void> {
  await createNotifications([
    {
      recipientId: input.inviteeId,
      actorId: input.actorId,
      type: 'trip_invitation',
      tripId: input.tripId,
      tripName: input.tripName,
      entityType: 'invitation',
      entityId: input.invitationId,
      entityLabel: input.tripName,
      title: 'Trip invitation',
      message: `${input.actorName} invited you to ${input.tripName}.`,
      idempotencyKey: `trip_invitation:${input.invitationId}`,
    },
  ]);
}

export async function notifyBookingEvent(input: {
  actorId: string;
  actorName: string;
  trip: TripDocument;
  bookingId: string;
  bookingTitle: string;
  kind: 'booking_created' | 'booking_updated' | 'booking_deleted';
}): Promise<void> {
  const verb =
    input.kind === 'booking_created'
      ? 'added'
      : input.kind === 'booking_updated'
        ? 'updated'
        : 'deleted';
  const categoryHint = input.bookingTitle;
  const tripName = input.trip.name;
  const recipients = tripMemberUserIds(input.trip).filter((id) => id !== input.actorId);
  await createNotifications(
    recipients.map((recipientId) => ({
      recipientId,
      actorId: input.actorId,
      type: input.kind,
      tripId: input.trip._id.toString(),
      tripName,
      entityType: 'booking' as const,
      entityId: input.bookingId,
      entityLabel: categoryHint,
      title: 'Booking update',
      message: `${input.actorName} ${verb} the booking: ${categoryHint}.`,
    })),
  );
}

export async function notifyExpenseEvent(input: {
  actorId: string;
  actorName: string;
  tripId: string;
  tripName: string;
  expenseId: string;
  expenseDescription: string;
  recipientIds: string[];
  kind: 'expense_created' | 'expense_updated' | 'expense_deleted';
}): Promise<void> {
  const verb =
    input.kind === 'expense_created'
      ? 'added'
      : input.kind === 'expense_updated'
        ? 'updated'
        : 'deleted';
  const recipients = [...new Set(input.recipientIds)].filter((id) => id !== input.actorId);
  await createNotifications(
    recipients.map((recipientId) => ({
      recipientId,
      actorId: input.actorId,
      type: input.kind,
      tripId: input.tripId,
      tripName: input.tripName,
      entityType: 'expense' as const,
      entityId: input.expenseId,
      entityLabel: input.expenseDescription,
      title: 'Expense update',
      message: `${input.actorName} ${verb} an expense: ${input.expenseDescription}.`,
    })),
  );
}

export async function notifySettlementEvent(input: {
  actorId: string;
  actorName: string;
  tripId: string;
  tripName: string;
  settlementId: string;
  payerId: string;
  recipientId: string;
  amountMinor: number;
  currency: string;
  kind: 'settlement_recorded' | 'settlement_cancelled';
}): Promise<void> {
  const verb = input.kind === 'settlement_recorded' ? 'recorded' : 'cancelled';
  const label = `${input.currency} ${(input.amountMinor / 100).toFixed(2)}`;
  const partyIds = [input.payerId, input.recipientId].filter((id) => id !== input.actorId);
  await createNotifications(
    partyIds.map((recipientId) => ({
      recipientId,
      actorId: input.actorId,
      type: input.kind,
      tripId: input.tripId,
      tripName: input.tripName,
      entityType: 'settlement' as const,
      entityId: input.settlementId,
      entityLabel: label,
      title: 'Settlement update',
      message: `${input.actorName} ${verb} a settlement (${label}).`,
    })),
  );
}

async function createNotifications(rows: CreateNotificationInput[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  for (const row of rows) {
    try {
      await NotificationModel.create({
        recipientId: row.recipientId,
        actorId: row.actorId,
        type: row.type,
        tripId: row.tripId ? new mongoose.Types.ObjectId(row.tripId) : null,
        tripName: row.tripName ?? '',
        entityType: row.entityType ?? null,
        entityId: row.entityId ? new mongoose.Types.ObjectId(row.entityId) : null,
        entityLabel: row.entityLabel ?? '',
        title: row.title,
        message: row.message,
        readAt: null,
        idempotencyKey: row.idempotencyKey ?? null,
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        continue;
      }
      console.error('[Tavelo] notification create failed:', error);
    }
  }
}

function decodeCursor(raw: string | undefined): NotificationCursor | null {
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

function encodeCursor(cursor: NotificationCursor): string {
  return Buffer.from(
    JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id.toString() }),
  ).toString('base64url');
}

function assertDatabaseConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The database is unavailable. Try again in a moment.',
    );
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function loadActorName(actorId: string): Promise<string> {
  const map = await loadUserSummaries([actorId]);
  return map.get(actorId)?.name ?? 'Someone';
}
