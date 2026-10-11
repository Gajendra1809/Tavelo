import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { getUnreadNotificationCount } from '@/services/notificationService';

let globalUnread = 0;
const listeners = new Set<(count: number) => void>();

export function setNotificationUnreadCount(count: number): void {
  globalUnread = count;
  for (const listener of listeners) {
    listener(count);
  }
}

/** Fetch unread count from the API and update all bell subscribers. */
export async function fetchAndPublishUnreadCount(): Promise<void> {
  try {
    const next = await getUnreadNotificationCount();
    setNotificationUnreadCount(next);
  } catch {
    // Keep prior count; bell should not break the app.
  }
}

export function useNotificationUnreadCount(): {
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { status } = useAuth();
  const [count, setCount] = useState(globalUnread);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCount(globalUnread);
    const listener = (next: number) => setCount(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setNotificationUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      await fetchAndPublishUnreadCount();
    } finally {
      setLoading(false);
    }
  }, [status]);

  return { count, loading, refresh };
}
