import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { TripMemoryItem } from '@/types/memory';

export type MemoryDownloadResult = {
  saved: number;
  failed: number;
  message: string;
};

/** Expo Go does not ship the SDK 57 media-library native module (`ExpoMediaLibraryNext`). */
function runsInExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function extensionForItem(item: TripMemoryItem): string {
  const name = item.originalFilename?.trim() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    return name.slice(dot);
  }
  if (item.mimeType === 'image/png') {
    return '.png';
  }
  if (item.mimeType === 'image/webp') {
    return '.webp';
  }
  if (item.mimeType === 'video/quicktime') {
    return '.mov';
  }
  if (item.mediaType === 'video') {
    return '.mp4';
  }
  return '.jpg';
}

function downloadFilename(item: TripMemoryItem): string {
  const base = item.originalFilename?.trim() || `tavelo-${item.id}${extensionForItem(item)}`;
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function downloadOnWeb(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Download failed.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

async function saveViaShareSheet(localUri: string, item: TripMemoryItem): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(localUri, {
    mimeType: item.mimeType,
    dialogTitle: 'Save memory',
  });
}

async function saveToPhotoLibrary(localUri: string): Promise<void> {
  // Loaded only in dev/production builds — never in Expo Go (avoids native module crash).
  const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (!current.granted && current.accessPrivileges !== 'limited') {
    const requested = await MediaLibrary.requestPermissionsAsync(true);
    if (!requested.granted && requested.accessPrivileges !== 'limited') {
      throw new Error('Photo library permission is required to save downloads.');
    }
  }
  await MediaLibrary.saveToLibraryAsync(localUri);
}

export async function ensureMemoryDownloadPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  if (runsInExpoGo()) {
    return Sharing.isAvailableAsync();
  }
  try {
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (current.granted || current.accessPrivileges === 'limited') {
      return true;
    }
    const requested = await MediaLibrary.requestPermissionsAsync(true);
    return requested.granted || requested.accessPrivileges === 'limited';
  } catch {
    return Sharing.isAvailableAsync();
  }
}

export async function downloadTripMemoryItem(item: TripMemoryItem): Promise<void> {
  const url = item.mediaUrl;
  if (!url) {
    throw new Error('This file is not available to download right now.');
  }

  const filename = downloadFilename(item);

  if (Platform.OS === 'web') {
    await downloadOnWeb(url, filename);
    return;
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Could not access local storage for the download.');
  }

  const localUri = `${cacheDir}${filename}`;
  const download = await FileSystem.downloadAsync(url, localUri);
  if (download.status !== 200) {
    throw new Error('Download failed.');
  }

  try {
    if (runsInExpoGo()) {
      await saveViaShareSheet(download.uri, item);
    } else {
      try {
        await saveToPhotoLibrary(download.uri);
      } catch {
        await saveViaShareSheet(download.uri, item);
      }
    }
  } finally {
    await FileSystem.deleteAsync(download.uri, { idempotent: true });
  }
}

export async function downloadTripMemoryItems(
  items: TripMemoryItem[],
  options?: { onProgress?: (completed: number, total: number) => void },
): Promise<MemoryDownloadResult> {
  if (items.length === 0) {
    return { saved: 0, failed: 0, message: 'Nothing selected to download.' };
  }

  if (runsInExpoGo() && items.length > 1) {
    return {
      saved: 0,
      failed: 0,
      message:
        'Bulk save isn’t available in Expo Go. Open one item and use Save to device (share sheet → Save to Photos), or use a development build.',
    };
  }

  const permitted = await ensureMemoryDownloadPermission();
  if (!permitted) {
    return {
      saved: 0,
      failed: items.length,
      message: 'Permission is required to save downloads.',
    };
  }

  let saved = 0;
  let failed = 0;
  const total = items.length;

  for (let index = 0; index < items.length; index += 1) {
    try {
      await downloadTripMemoryItem(items[index]!);
      saved += 1;
    } catch {
      failed += 1;
    }
    options?.onProgress?.(index + 1, total);
  }

  const destination = Platform.OS === 'web'
    ? 'your downloads folder'
    : runsInExpoGo()
      ? 'your device (use Save to Photos in the share sheet)'
      : 'your photo library';

  if (saved === total) {
    return {
      saved,
      failed,
      message:
        total === 1 ? `Saved to ${destination}.` : `Saved ${saved} items to ${destination}.`,
    };
  }
  if (saved === 0) {
    return { saved, failed, message: 'Could not save the selected items. Try again.' };
  }
  return {
    saved,
    failed,
    message: `Saved ${saved} of ${total}. ${failed} could not be downloaded.`,
  };
}
