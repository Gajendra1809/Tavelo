import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ApiError } from '@/lib/apiClient';
import { readApiConfig } from '@/lib/config';

/** Short text for alerts and inline UI. */
export function userFacingMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/** Full report to copy into chat, email, or Cursor. */
export function formatErrorReport(error: unknown, context?: string): string {
  const lines: string[] = ['Tavelo error report', `Time: ${new Date().toISOString()}`];

  if (context) {
    lines.push(`Context: ${context}`);
  }

  lines.push(`Platform: ${Platform.OS}`);
  lines.push(`Expo: ${Constants.expoConfig?.version ?? Constants.expoVersion ?? 'unknown'}`);

  try {
    const config = readApiConfig();
    if ('error' in config) {
      lines.push(`API config: ${config.error}`);
    } else {
      lines.push(`API base: ${config.baseUrl}`);
    }
  } catch {
    lines.push('API base: (could not read config)');
  }

  if (error instanceof ApiError) {
    lines.push(`Type: ApiError`);
    lines.push(`Code: ${error.code}`);
    if (error.status !== undefined) {
      lines.push(`HTTP status: ${error.status}`);
    }
    lines.push(`Message: ${error.message}`);
  } else if (error instanceof Error) {
    lines.push(`Type: ${error.name}`);
    lines.push(`Message: ${error.message}`);
    if (error.stack) {
      lines.push(`Stack:\n${error.stack}`);
    }
  } else {
    lines.push(`Raw: ${String(error)}`);
  }

  return lines.join('\n');
}

/**
 * Log to Expo / React Native dev tooling (LogBox + Metro terminal) and return the full report for optional UI copy.
 * In Expo Go, open the dev menu → warnings/errors, or read the terminal where `npm run dev:mobile` runs.
 */
export function logAppError(context: string, error: unknown): string {
  const report = formatErrorReport(error, context);
  const summary = `[Tavelo] ${context}: ${userFacingMessage(error)}`;
  if (__DEV__) {
    console.error(summary);
    console.error(report);
  } else {
    console.warn(summary);
  }
  return report;
}
