import type { AppNotification, NotificationEntityType } from '@/types/notification';

const ENTITY_TYPES = new Set<NotificationEntityType>([
  'invitation',
  'booking',
  'expense',
  'settlement',
  'message',
  'poll',
]);

export function notificationFromPushData(
  data: Record<string, unknown> | null | undefined,
): AppNotification | null {
  const type = stringField(data, 'type');
  if (!type) {
    return null;
  }
  const tripId = stringField(data, 'tripId');
  const entityType = stringField(data, 'entityType');
  const entityId = stringField(data, 'entityId');
  return {
    id: stringField(data, 'notificationId') ?? 'push',
    type,
    title: '',
    message: '',
    readAt: null,
    createdAt: new Date(0).toISOString(),
    trip: tripId ? { id: tripId, name: '' } : null,
    entityType: entityType && ENTITY_TYPES.has(entityType as NotificationEntityType)
      ? (entityType as NotificationEntityType)
      : null,
    entityId: entityId || null,
    entityLabel: '',
    actor: { id: '', name: '', avatarUrl: null },
  };
}

function stringField(
  data: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = data?.[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
