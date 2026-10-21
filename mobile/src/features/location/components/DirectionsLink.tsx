import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { openMapsDirections } from '@/features/location/openInMaps';
import { canOpenMaps } from '@/features/location/placeDisplay';
import type { TaveloPlace } from '@/features/location/types';
import { colors, spacing, typography } from '@/theme';

type DirectionsLinkProps = {
  place: TaveloPlace;
  label?: string;
};

export function DirectionsLink({ place, label = 'Directions' }: DirectionsLinkProps) {
  if (!canOpenMaps(place)) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void openMapsDirections(place)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <SymbolView
        name={{ android: 'directions', web: 'directions' }}
        size={18}
        tintColor={colors.primary}
      />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.label,
    color: colors.primary,
  },
});
