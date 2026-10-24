import type { UserSummary } from '../users/user.service';
import type { NotificationDocument } from './notification.model';

export type NotificationResponse = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  trip: { id: string; name: string } | null;
  entityType: 'invitation' | 'booking' | 'expense' | 'settlement' | 'message' | 'poll' | null;
  entityId: string | null;
  entityLabel: string;
  actor: { id: string; name: string; avatarUrl: string | null };
};

export function toNotificationResponse(
  doc: NotificationDocument,
  actorId: string,
  actor: UserSummary,
): NotificationResponse {
  return {
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    trip: doc.tripId
      ? { id: doc.tripId.toString(), name: doc.tripName ?? '' }
      : null,
    entityType: doc.entityType ?? null,
    entityId: doc.entityId ? doc.entityId.toString() : null,
    entityLabel: doc.entityLabel ?? '',
    actor: {
      id: actorId,
      name: actor.name,
      avatarUrl: actor.avatarUrl,
    },
  };
}
