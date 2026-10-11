import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Atmosphere } from '@/components/Atmosphere';
import { colors, spacing, typography } from '@/theme';

export function BootScreen() {
  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Checking your session">
      <Atmosphere />
      <Text style={styles.brand}>Tavelo</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.sky,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  brand: {
    ...typography.title,
    color: colors.ink,
    fontSize: 32,
  },
});
