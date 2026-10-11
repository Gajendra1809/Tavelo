import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, typography } from '@/theme';

export function HeaderBackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/trips');
        }
      }}
      style={styles.button}
    >
      <Text style={styles.label}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  label: {
    ...typography.label,
    color: colors.primary,
  },
});
