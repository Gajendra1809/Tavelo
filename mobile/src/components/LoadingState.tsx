import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type LoadingStateProps = {
  message: string;
};

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <View accessibilityRole="progressbar" style={styles.container}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
  },
});
