import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, surfaceCard, typography } from '@/theme';

type ComingSoonProps = {
  title: string;
  message: string;
  tone?: 'plain' | 'teal';
};

export function ComingSoon({ title, message, tone = 'plain' }: ComingSoonProps) {
  const teal = tone === 'teal';

  return (
    <View style={[styles.card, teal ? styles.teal : null]}>
      <Text style={[styles.eyebrow, teal ? styles.tealText : null]}>Coming soon</Text>
      <Text style={[styles.title, teal ? styles.tealText : null]}>{title}</Text>
      <Text style={[styles.message, teal ? styles.tealMuted : null]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  teal: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryPressed,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.primary,
  },
  title: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  message: {
    ...typography.body,
    color: colors.muted,
  },
  tealText: {
    color: colors.onPrimary,
  },
  tealMuted: {
    color: 'rgba(255, 255, 255, 0.88)',
  },
});
