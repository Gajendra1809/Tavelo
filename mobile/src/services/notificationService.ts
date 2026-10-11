import { NOTIFICATIONS_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import type { AppNotification, NotificationsPage } from '@/types/notification';

export async function listNotifications(options: {
  limit?: number;
  cursor?: string | null;
} = {}): Promise<NotificationsPage> {
  const params = new URLSearchParams();
  if (options.limit) {
    params.set('limit', String(options.limit));
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  const query = params.toString();
  return apiRequest<NotificationsPage>(`${NOTIFICATIONS_PATH}${query ? `?${query}` : ''}`);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const data = await apiRequest<{ count: number }>(`${NOTIFICATIONS_PATH}/unread-count`);
  return data.count;
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  return apiRequest<AppNotification>(`${NOTIFICATIONS_PATH}/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiRequest<{ updated: number }>(`${NOTIFICATIONS_PATH}/read-all`, {
    method: 'PATCH',
  });
}
