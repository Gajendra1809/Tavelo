import { StyleSheet, Text, View } from 'react-native';
import { CoverMark } from '@/components/CoverMark';
import { UserAvatar } from '@/components/UserAvatar';
import { formatDateRange } from '@/lib/dates';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';
import type { Trip } from '@/types/trip';

type TripCompactBannerProps = {
  trip: Trip;
};

export function TripCompactBanner({ trip }: TripCompactBannerProps) {
  const title = trip.title || trip.name;
  const members = trip.members ?? [];

  return (
    <View style={styles.banner}>
      <CoverMark
        uri={trip.coverImageUrl}
        cacheKey={`trip-cover:${trip.id}`}
        label={trip.destination}
        style={styles.cover}
        textStyle={styles.coverText}
      />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.destination}>
          {trip.destination}
        </Text>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {formatDateRange(trip.startDate, trip.endDate)}
          {members.length > 0 ? ` · ${members.length} going` : ''}
        </Text>
      </View>
      <View style={styles.faces}>
        {members.slice(0, 3).map((member, index) => (
          <UserAvatar
            key={member.userId}
            name={member.name}
            uri={member.avatarUrl}
            cacheKey={`avatar:${member.userId}`}
            size="xs"
            style={[styles.face, index > 0 ? styles.faceOverlap : null]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    ...surfaceCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  cover: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  coverText: {
    fontSize: 22,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  destination: {
    ...typography.label,
    color: colors.primary,
  },
  title: {
    ...typography.cardTitle,
    fontSize: 16,
    color: colors.ink,
  },
  meta: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderWidth: 2,
    borderColor: colors.surface,
  },
  faceOverlap: {
    marginLeft: -10,
  },
});
