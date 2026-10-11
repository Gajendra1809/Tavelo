import { File, UploadType } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const STAGED_UPLOAD_MARKER = '/tavelo-upload-';

function extensionForUpload(contentType: string): string {
  if (contentType.includes('pdf')) {
    return 'pdf';
  }
  if (contentType.includes('png')) {
    return 'png';
  }
  if (contentType.includes('webp')) {
    return 'webp';
  }
  if (contentType.includes('video')) {
    return 'mp4';
  }
  return 'jpg';
}

export function isStagedUploadUri(uri: string): boolean {
  return uri.includes(STAGED_UPLOAD_MARKER);
}

async function copyPickerUriToDest(uri: string, dest: string): Promise<void> {
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return;
  } catch {
    // DocumentPicker cache paths on Android Expo Go are often unreadable; try other readers.
  }

  try {
    const source = new File(uri);
    const bytes = await source.arrayBuffer();
    if (bytes.byteLength <= 0) {
      throw new Error('empty');
    }
    const destFile = new File(dest);
    const writer = destFile.writableStream().getWriter();
    await writer.write(new Uint8Array(bytes));
    await writer.close();
    return;
  } catch {
    // Fall through.
  }

  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error('fetch failed');
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength <= 0) {
      throw new Error('empty');
    }
    const destFile = new File(dest);
    const writer = destFile.writableStream().getWriter();
    await writer.write(new Uint8Array(bytes));
    await writer.close();
    return;
  } catch {
    throw new Error(
      'Could not read the selected file. For photos on Android, use Photo library instead of Files.',
    );
  }
}

/**
 * Copy picker URIs into app cache immediately. DocumentPicker temp files on Android are often
 * deleted or unreadable by the uploader after an async gap (e.g. upload-intent round trip).
 */
export async function stageLocalFileForUpload(uri: string, contentType: string): Promise<string> {
  if (Platform.OS === 'web') {
    return uri;
  }

  if (isStagedUploadUri(uri)) {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
      return uri;
    }
  }

  const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheDir) {
    throw new Error('App storage is not available.');
  }

  const dest = `${cacheDir}tavelo-upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensionForUpload(contentType)}`;

  if (!uri.startsWith('content://')) {
    const sourceInfo = await FileSystem.getInfoAsync(uri);
    if (!sourceInfo.exists) {
      throw new Error('The selected file is no longer available. Please choose it again.');
    }
  }

  await copyPickerUriToDest(uri, dest);

  const destInfo = await FileSystem.getInfoAsync(dest, { size: true });
  if (
    !destInfo.exists ||
    !('size' in destInfo) ||
    typeof destInfo.size !== 'number' ||
    destInfo.size <= 0
  ) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    throw new Error('Could not prepare the file for upload.');
  }

  return dest;
}

/** Size in bytes for upload-intent; uses filesystem metadata when the picker omits fileSize. */
export async function resolveLocalByteSize(uri: string, fallback = 0): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
      return info.size;
    }
  } catch {
    // Fall through to fallback.
  }
  return fallback;
}

/**
 * PUT local file bytes to a presigned URL. React Native's fetch(uri).blob() often uploads empty
 * bodies for content:// and file:// URIs; staging plus expo-file-system upload is reliable on device.
 */
export async function putLocalFileToSignedUrl(
  uploadUrl: string,
  uri: string,
  contentType: string,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  onProgress?.(0.1);

  if (Platform.OS === 'web') {
    const file = await fetch(uri);
    const blob = await file.blob();
    onProgress?.(0.4);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!response.ok) {
      throw new Error(`Storage upload failed (HTTP ${response.status}).`);
    }
    onProgress?.(1);
    return;
  }

  const fileUri = await stageLocalFileForUpload(uri, contentType);
  const cleanup = isStagedUploadUri(fileUri);
  onProgress?.(0.25);
  try {
    const file = new File(fileUri);
    const result = await file.upload(uploadUrl, {
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
      mimeType: contentType,
      onProgress: onProgress
        ? ({ bytesSent, totalBytes }) => {
            if (totalBytes > 0) {
              onProgress(0.25 + (bytesSent / totalBytes) * 0.65);
            }
          }
        : undefined,
    });
    onProgress?.(0.9);
    if (result.status < 200 || result.status >= 300) {
      const snippet = result.body?.slice(0, 120) ?? '';
      throw new Error(
        `Storage upload failed (HTTP ${result.status})${snippet ? `: ${snippet}` : ''}.`,
      );
    }
    onProgress?.(1);
  } finally {
    if (cleanup) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
    }
  }
}
