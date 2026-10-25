import { useEffect } from 'react';
import {
  openInitialPushNotification,
  openPushData,
  pushAlertsAvailable,
  subscribeToPushOpens,
  subscribeToPushTokenRefresh,
  syncPushTokenIfGranted,
} from '@/features/notifications/pushRegistration';

const openedIds = new Set<string>();

/** Registers an already-permitted device and opens the screen for a tapped alert. */
export function PushNotificationBridge() {
  useEffect(() => {
    if (!pushAlertsAvailable()) {
      return;
    }
    void syncPushTokenIfGranted().catch(() => undefined);
    void openInitialPushNotification().catch(() => undefined);
    const stopOpens = subscribeToPushOpens((data) => {
      const id = typeof data.notificationId === 'string' ? data.notificationId : '';
      if (id && openedIds.has(id)) {
        return;
      }
      if (id) {
        openedIds.add(id);
      }
      void openPushData(data).catch(() => undefined);
    });
    const stopRefresh = subscribeToPushTokenRefresh(() => {
      void syncPushTokenIfGranted().catch(() => undefined);
    });
    return () => {
      stopOpens();
      stopRefresh();
    };
  }, []);

  return null;
}
