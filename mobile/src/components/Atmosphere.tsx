import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export function Atmosphere() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[colors.sky, colors.ivory, colors.background]}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.wash} />
      <View style={styles.arc} />
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.seafoam,
    opacity: 0.45,
    top: -90,
    right: -110,
  },
  arc: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: 'rgba(8, 127, 120, 0.16)',
    bottom: -120,
    left: -90,
  },
});
