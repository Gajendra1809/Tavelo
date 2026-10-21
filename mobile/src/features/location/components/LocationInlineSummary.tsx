import { StyleSheet, Text, View } from 'react-native';
import { DirectionsLink } from '@/features/location/components/DirectionsLink';
import { canOpenMaps, placePrimaryLine, placeSecondaryLine } from '@/features/location/placeDisplay';
import type { TaveloPlace } from '@/types/place';
import { colors, spacing, typography } from '@/theme';

type LocationInlineSummaryProps = {
  place: TaveloPlace | null;
  compact?: boolean;
  /** Hide the title line when the parent already shows the same label (e.g. trip destination). */
  hideName?: boolean;
};

export function LocationInlineSummary({
  place,
  compact = false,
  hideName = false,
}: LocationInlineSummaryProps) {
  if (!place) {
    return null;
  }

  const showName = !hideName;
  const showMaps = canOpenMaps(place);

  return (
    <View style={styles.wrap}>
      {showName ? (
        <Text style={compact ? styles.nameCompact : styles.name}>{placePrimaryLine(place)}</Text>
      ) : null}
      {placeSecondaryLine(place) ? (
        <Text style={styles.address} numberOfLines={compact ? 2 : undefined}>
          {placeSecondaryLine(place)}
        </Text>
      ) : null}
      {showMaps ? (
        <DirectionsLink place={place} label={compact ? 'Directions' : 'Open in Maps'} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
  },
  nameCompact: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  address: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
});
