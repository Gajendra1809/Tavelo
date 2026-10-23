import { Image, StyleSheet, Text, View } from 'react-native';
import { TaveloMascot } from '@/components/TaveloMascot';
import { illustrationSource, type IllustrationKey } from '@/constants/images';
import { colors, radius, spacing, typography } from '@/theme';

type EmptyStateProps = {
  title: string;
  message: string;
  illustration?: IllustrationKey;
  mascot?: boolean;
};

export function EmptyState({ title, message, illustration, mascot = false }: EmptyStateProps) {
  return (
    <View style={[styles.container, mascot ? styles.containerOpen : null]}>
      {mascot ? <TaveloMascot size={132} /> : null}
      {!mascot && illustration ? (
        <Image
          accessibilityIgnoresInvertColors
          source={illustrationSource(illustration)}
          style={styles.image}
        />
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.seafoam,
    alignItems: 'center',
  },
  containerOpen: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  image: {
    width: '100%',
    maxWidth: 280,
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.ivory,
  },
  title: {
    ...typography.label,
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
  },
});
