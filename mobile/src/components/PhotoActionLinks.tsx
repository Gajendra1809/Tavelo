import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme';

type PhotoActionLinksProps = {
  busy?: boolean;
  hasPhoto: boolean;
  changeLabel?: string;
  removeLabel?: string;
  onChange: () => void;
  onRemove?: () => void;
};

export function PhotoActionLinks({
  busy = false,
  hasPhoto,
  changeLabel = 'Choose photo',
  removeLabel = 'Remove',
  onChange,
  onRemove,
}: PhotoActionLinksProps) {
  return (
    <View style={styles.row}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        hitSlop={8}
        onPress={onChange}
      >
        {({ pressed }) => (
          <Text style={[styles.change, pressed && !busy ? styles.changePressed : null, busy && styles.disabled]}>
            {busy ? 'Uploading…' : changeLabel}
          </Text>
        )}
      </Pressable>
      {hasPhoto && onRemove ? (
        <>
          <Text style={styles.sep} accessibilityElementsHidden>
            ·
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={8}
            onPress={onRemove}
          >
            {({ pressed }) => (
              <Text style={[styles.remove, pressed && !busy ? styles.removePressed : null, busy && styles.disabled]}>
                {removeLabel}
              </Text>
            )}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  spinner: {
    marginRight: 4,
  },
  change: {
    ...typography.label,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  changePressed: {
    color: colors.primaryPressed,
  },
  remove: {
    ...typography.label,
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  removePressed: {
    opacity: 0.75,
  },
  sep: {
    ...typography.label,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
