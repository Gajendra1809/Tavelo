import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { openMapsDirections } from '@/features/location/openInMaps';
import { canOpenMaps } from '@/features/location/placeDisplay';
import type { TaveloPlace } from '@/features/location/types';
import { colors, spacing, typography } from '@/theme';

type DirectionsLinkProps = {
  place: TaveloPlace;
  label?: string;
  compact?: boolean;
};

export function DirectionsLink({ place, label = 'Directions', compact = false }: DirectionsLinkProps) {
  if (!canOpenMaps(place)) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void openMapsDirections(place)}
      style={({ pressed }) => [styles.row, compact ? styles.rowCompact : null, pressed ? styles.pressed : null]}
    >
      <SymbolView
        name={{ android: 'directions', web: 'directions' }}
        size={compact ? 16 : 18}
        tintColor={colors.primary}
      />
      <Text style={[styles.label, compact ? styles.labelCompact : null]}>{label}</Text>
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
  rowCompact: {
    minHeight: 28,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.label,
    color: colors.primary,
  },
  labelCompact: {
    fontSize: 13,
  },
});
