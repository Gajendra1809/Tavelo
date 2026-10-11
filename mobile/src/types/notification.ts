export type NotificationEntityType = 'invitation' | 'booking' | 'expense' | 'settlement';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  trip: { id: string; name: string } | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  entityLabel: string;
  actor: { id: string; name: string; avatarUrl: string | null };
};

export type NotificationsPage = {
  notifications: AppNotification[];
  nextCursor: string | null;
};
