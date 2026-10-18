import { StyleSheet, Text, View } from 'react-native';
import type { TaveloPlace } from '@/features/location/types';
import { hasVerifiedCoordinates } from '@/features/location/types';
import { colors, radius, spacing, typography } from '@/theme';

type LocationStatusBadgeProps = {
  place: TaveloPlace;
};

export function LocationStatusBadge({ place }: LocationStatusBadgeProps) {
  const verified = hasVerifiedCoordinates(place);
  const label = verified
    ? 'Verified coordinates'
    : place.source === 'manual'
      ? 'Manual entry — not verified'
      : 'No coordinates';

  return (
    <View
      style={[
        styles.badge,
        verified ? styles.badgeVerified : styles.badgeManual,
      ]}
    >
      <Text style={[styles.text, verified ? styles.textVerified : styles.textManual]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeVerified: {
    backgroundColor: colors.successSurface,
  },
  badgeManual: {
    backgroundColor: colors.ivory,
    borderWidth: 1,
    borderColor: colors.line,
  },
  text: {
    ...typography.label,
    fontSize: 11,
  },
  textVerified: {
    color: colors.success,
  },
  textManual: {
    color: colors.muted,
  },
});
