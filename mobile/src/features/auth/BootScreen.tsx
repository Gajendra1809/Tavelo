import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Atmosphere } from '@/components/Atmosphere';
import { TaveloMascot } from '@/components/TaveloMascot';
import { TaveloLogo } from '@/components/TaveloLogo';
import { colors, spacing } from '@/theme';

export function BootScreen() {
  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Checking your session">
      <Atmosphere />
      <View style={styles.stack}>
        <TaveloMascot size={112} />
        <TaveloLogo height={60} loop align="center" />
        <ActivityIndicator color={colors.primary} />
      </View>
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
  stack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
