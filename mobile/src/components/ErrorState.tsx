import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { PrimaryButton } from './PrimaryButton';

type ErrorStateProps = {
  title?: string;
  message: string;
  /** Full text for “Copy details” (API codes, HTTP status, API URL, etc.). */
  details?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
}: ErrorStateProps) {
  const [copied, setCopied] = useState(false);
  const copyPayload = details?.trim() ? `${title}\n${message}\n\n${details}` : `${title}\n${message}`;

  async function copyDetails() {
    await Clipboard.setStringAsync(copyPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text selectable style={styles.message}>
        {message}
      </Text>
      <View style={styles.actions}>
        {onRetry ? <PrimaryButton label="Try again" onPress={onRetry} style={styles.actionBtn} /> : null}
        <Pressable accessibilityRole="button" onPress={() => void copyDetails()} style={styles.copyBtn}>
          <Text style={styles.copyLabel}>{copied ? 'Copied — paste in chat' : 'Copy error details'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.dangerSurface,
  },
  title: {
    ...typography.label,
    color: colors.danger,
  },
  message: {
    ...typography.body,
    color: colors.ink,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    alignSelf: 'stretch',
  },
  copyBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  copyLabel: {
    ...typography.label,
    fontSize: 13,
    color: colors.primary,
  },
});
