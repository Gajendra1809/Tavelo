import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  style,
}: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.inactive : null,
        style,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.background,
  },
  inactive: {
    opacity: 0.6,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
});
