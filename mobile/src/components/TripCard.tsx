import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateRange } from '@/lib/dates';
import { isUpcomingTrip } from '@/lib/tripGroups';
import type { Trip } from '@/types/trip';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';
import { CoverMark } from './CoverMark';

type TripCardProps = {
  trip: Trip;
  onPress: () => void;
};

export function TripCard({ trip, onPress }: TripCardProps) {
  const title = trip.title || trip.name;
  const upcoming = isUpcomingTrip(trip);
  const memberCount = trip.members?.length ?? 0;
  const memberLabel =
    memberCount === 1 ? '1 member' : memberCount > 1 ? `${memberCount} members` : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.destination}, ${title}, ${formatDateRange(trip.startDate, trip.endDate)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.media}>
        <CoverMark
          uri={trip.coverImageUrl}
          cacheKey={`trip-cover:${trip.id}`}
          label={trip.destination}
          style={styles.cover}
          textStyle={styles.coverText}
        />
        <View style={[styles.badge, upcoming ? styles.badgeUpcoming : styles.badgePast]}>
          <Text style={[styles.badgeText, upcoming ? styles.badgeTextUpcoming : styles.badgeTextPast]}>
            {upcoming ? 'Upcoming' : 'Past'}
          </Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.destination}>{trip.destination}</Text>
        <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        {memberLabel ? <Text style={styles.members}>{memberLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...surfaceCard,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.94,
  },
  media: {
    height: 148,
    backgroundColor: colors.seafoam,
  },
  cover: {
    width: '100%',
    height: 148,
  },
  coverText: {
    fontSize: 36,
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeUpcoming: {
    backgroundColor: colors.seafoam,
  },
  badgePast: {
    backgroundColor: colors.ivory,
  },
  badgeText: {
    ...typography.label,
    fontSize: 12,
  },
  badgeTextUpcoming: {
    color: colors.primaryPressed,
  },
  badgeTextPast: {
    color: colors.muted,
  },
  copy: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  name: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  destination: {
    ...typography.body,
    color: colors.ink,
  },
  dates: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  members: {
    ...typography.body,
    fontSize: 14,
    color: colors.primary,
  },
});
