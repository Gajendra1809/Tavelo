import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Atmosphere } from '@/components/Atmosphere';
import { TaveloLogo } from '@/components/TaveloLogo';
import { colors, spacing } from '@/theme';

export function BootScreen() {
  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Checking your session">
      <Atmosphere />
      <TaveloLogo height={60} />
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
});
