import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  accessToken: 'tavelo.accessToken',
  refreshToken: 'tavelo.refreshToken',
  accessExpiresAt: 'tavelo.accessExpiresAt',
  user: 'tavelo.user',
} as const;

export const tokenKeys = KEYS;

export async function readToken(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function writeToken(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteToken(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
