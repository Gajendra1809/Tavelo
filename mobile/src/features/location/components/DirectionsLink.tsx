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
  const enabled = canOpenMaps(place);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => void openMapsDirections(place)}
      style={({ pressed }) => [styles.row, pressed && enabled ? styles.pressed : null, !enabled ? styles.disabled : null]}
    >
      <SymbolView
        name={{ android: 'directions', web: 'directions' }}
        size={18}
        tintColor={enabled ? colors.primary : colors.muted}
      />
      <Text style={[styles.label, !enabled ? styles.labelDisabled : null]}>{label}</Text>
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
  disabled: {
    opacity: 0.55,
  },
  label: {
    ...typography.label,
    color: colors.primary,
  },
  labelDisabled: {
    color: colors.muted,
  },
});
