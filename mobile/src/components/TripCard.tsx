import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { UserAvatar } from '@/components/UserAvatar';
import { placePrimaryLine, placeSecondaryLine } from '@/features/location/placeDisplay';
import { avatarImageCacheKey } from '@/lib/avatarDisplay';
import { formatDateRange } from '@/lib/dates';
import { isUpcomingTrip } from '@/lib/tripGroups';
import type { Trip, TripMember } from '@/types/trip';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';
import { CoverMark } from './CoverMark';

type TripCardProps = {
  trip: Trip;
  onPress: () => void;
};

const MAX_VISIBLE_MEMBERS = 4;

export function TripCard({ trip, onPress }: TripCardProps) {
  const title = trip.title || trip.name;
  const upcoming = isUpcomingTrip(trip);
  const members = trip.members?.length ? trip.members : creatorAsMember(trip);
  const memberCount = members.length;
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS);
  const extraMembers = Math.max(0, memberCount - visibleMembers.length);
  const locationText = tripLocationLabel(trip);
  const dates = formatDateRange(trip.startDate, trip.endDate);
  const memberSummary =
    memberCount === 0
      ? ''
      : extraMembers > 0
        ? `${memberCount} members, ${extraMembers} more`
        : memberCount === 1
          ? '1 member'
          : `${memberCount} members`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.destination}, ${title}, ${dates}${memberSummary ? `, ${memberSummary}` : ''}`}
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
        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>
        <MetaRow icon="location_on" label={locationText} />
        <MetaRow icon="calendar_month" label={dates} />
        {visibleMembers.length > 0 ? (
          <View style={styles.membersRow} pointerEvents="none">
            <View style={styles.avatarStack}>
              {visibleMembers.map((member, index) => (
                <UserAvatar
                  key={member.userId}
                  name={member.name}
                  uri={member.avatarUrl}
                  cacheKey={avatarImageCacheKey(member.userId, member.avatarUrl)}
                  size="xs"
                  style={{
                    marginLeft: index === 0 ? 0 : -10,
                    zIndex: visibleMembers.length - index,
                    borderColor: colors.surface,
                    borderWidth: 2,
                  }}
                />
              ))}
            </View>
            {extraMembers > 0 ? (
              <Text style={styles.moreLabel}>+{extraMembers} more</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function MetaRow({ icon, label }: { icon: AndroidSymbol; label: string }) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIcon}>
        <SymbolView name={{ android: icon, web: icon }} size={16} tintColor={colors.primary} />
      </View>
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function tripLocationLabel(trip: Trip): string {
  const place = trip.destinationPlace;
  if (!place) {
    return trip.destination;
  }
  return placeSecondaryLine(place) ?? placePrimaryLine(place) ?? trip.destination;
}

function creatorAsMember(trip: Trip): TripMember[] {
  if (!trip.creator) {
    return [];
  }
  return [
    {
      userId: trip.creator.id,
      role: 'owner',
      name: trip.creator.name,
      avatarUrl: trip.creator.avatarUrl,
    },
  ];
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
    gap: spacing.sm,
  },
  name: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 20,
  },
  metaIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    ...typography.body,
    flex: 1,
    fontSize: 14,
    color: colors.muted,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    minHeight: 36,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreLabel: {
    ...typography.label,
    fontSize: 13,
    color: colors.muted,
    flexShrink: 1,
  },
});
