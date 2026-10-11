import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type PickerTriggerProps = {
  label: string;
  displayValue: string | null;
  placeholder: string;
  error?: string;
  onPress: () => void;
  icon: 'calendar' | 'schedule';
  onClear?: () => void;
  clearLabel?: string;
};

export function PickerTrigger({
  label,
  displayValue,
  placeholder,
  error,
  onPress,
  icon,
  onClear,
  clearLabel = 'Clear',
}: PickerTriggerProps) {
  const symbol = icon === 'calendar' ? 'calendar_month' : 'schedule';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, error ? styles.invalid : null]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => [styles.trigger, pressed ? styles.pressed : null]}
        >
          <SymbolView name={{ android: symbol, web: symbol }} size={20} tintColor={colors.primary} />
          <Text style={displayValue ? styles.value : styles.placeholder} numberOfLines={1}>
            {displayValue ?? placeholder}
          </Text>
        </Pressable>
        {onClear && displayValue ? (
          <Pressable accessibilityRole="button" accessibilityLabel={clearLabel} onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>{clearLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  row: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ivory,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  invalid: {
    borderColor: colors.danger,
  },
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.85,
  },
  value: {
    flex: 1,
    ...typography.body,
    color: colors.ink,
  },
  placeholder: {
    flex: 1,
    ...typography.body,
    color: colors.muted,
  },
  clear: {
    ...typography.label,
    fontSize: 13,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
  },
  error: {
    ...typography.body,
    fontSize: 14,
    color: colors.danger,
  },
});
