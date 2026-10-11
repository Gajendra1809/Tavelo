import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}: PrimaryButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
  },
  inactive: {
    opacity: 0.7,
  },
  label: {
    ...typography.label,
    color: colors.onPrimary,
  },
});
