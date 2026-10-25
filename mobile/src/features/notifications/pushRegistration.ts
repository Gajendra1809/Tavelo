import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { notificationFromPushData } from '@/features/notifications/pushPayload';
import { navigateFromNotification } from '@/features/notifications/notificationNavigation';
import { deactivatePushDevice, registerPushDevice } from '@/services/pushDeviceService';

const TOKEN_KEY = 'tavelo.pushToken';
const LAST_OPEN_KEY = 'tavelo.lastPushOpen';
const CHANNEL_ID = 'trip-updates';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function pushAlertsAvailable(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export async function readPushPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unavailable'> {
  if (!pushAlertsAvailable() || !Device.isDevice) {
    return 'unavailable';
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return 'granted';
  }
  if (current.canAskAgain === false) {
    return 'denied';
  }
  return 'undetermined';
}

/** Asks the system only after the user taps Enable on the profile card. */
export async function enablePushAlerts(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!pushAlertsAvailable() || !Device.isDevice) {
    return 'unavailable';
  }
  await ensureAndroidChannel();
  const result = await Notifications.requestPermissionsAsync();
  if (!result.granted) {
    return 'denied';
  }
  await syncPushToken();
  return 'granted';
}

/** Registers the token when permission was already granted. Does not prompt. */
export async function syncPushTokenIfGranted(): Promise<void> {
  if (!pushAlertsAvailable() || !Device.isDevice) {
    return;
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    return;
  }
  await syncPushToken();
}

export async function deactivateRegisteredPushDevice(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) {
    return;
  }
  try {
    await deactivatePushDevice(token);
  } catch {
    // Sign-out still continues if the API is unreachable.
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function subscribeToPushOpens(onOpen: (data: Record<string, unknown>) => void): () => void {
  const received = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen(response.notification.request.content.data ?? {});
  });
  return () => received.remove();
}

export async function openInitialPushNotification(): Promise<void> {
  if (!pushAlertsAvailable()) {
    return;
  }
  const response = await Notifications.getLastNotificationResponseAsync();
  const identifier = response?.notification.request.identifier;
  const data = response?.notification.request.content.data;
  if (!identifier || !data) {
    return;
  }
  const seen = await SecureStore.getItemAsync(LAST_OPEN_KEY);
  if (seen === identifier) {
    return;
  }
  await SecureStore.setItemAsync(LAST_OPEN_KEY, identifier);
  await openPushData(data);
}

export function subscribeToPushTokenRefresh(onRefresh: () => void): () => void {
  try {
    const subscription = Notifications.addPushTokenListener(() => onRefresh());
    return () => subscription.remove();
  } catch {
    // Expo Go on Android throws here. Remote alerts still work in the installed APK.
    return () => undefined;
  }
}

export async function openPushData(data: Record<string, unknown>): Promise<void> {
  const item = notificationFromPushData(data);
  if (!item) {
    return;
  }
  await navigateFromNotification(item);
}

async function syncPushToken(): Promise<void> {
  await ensureAndroidChannel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return;
  }
  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;
  if (!token) {
    return;
  }
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await registerPushDevice(token, platform);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Trip updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#087F78',
  });
}
