import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type SectionHeaderProps = {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, detail, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : detail ? (
        <Text style={styles.detail}>{detail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  detail: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  action: {
    ...typography.label,
    color: colors.primary,
  },
});
