import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { PrimaryButton } from './PrimaryButton';

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <PrimaryButton label="Try again" onPress={onRetry} /> : null}
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
});
