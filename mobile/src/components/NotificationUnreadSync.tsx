import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  fetchAndPublishUnreadCount,
  setNotificationUnreadCount,
} from '@/hooks/useNotificationUnreadCount';

const POLL_MS = 45_000;

/** Keeps the bell badge in sync without opening the notifications screen. */
export function NotificationUnreadSync() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') {
      setNotificationUnreadCount(0);
      return;
    }
    void fetchAndPublishUnreadCount();
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void fetchAndPublishUnreadCount();
      }
    });
    return () => subscription.remove();
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    const timer = setInterval(() => void fetchAndPublishUnreadCount(), POLL_MS);
    return () => clearInterval(timer);
  }, [status]);

  return null;
}
