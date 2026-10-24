import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Atmosphere } from '@/components/Atmosphere';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Skeleton } from '@/components/Skeleton';
import { UserAvatar } from '@/components/UserAvatar';
import { categoryLabel, categorySymbol } from '@/features/bookings/bookingLabels';
import { useTripFromCache } from '@/hooks/useTripFromCache';
import { formatDisplayDate, formatDateRange } from '@/lib/dates';
import { ApiError } from '@/lib/apiClient';
import { listTripBookings } from '@/services/bookingService';
import { BOOKING_CATEGORIES, type BookingCategory, type TripBooking } from '@/types/booking';
import { colors, radius, spacing, surfaceCard, typography } from '@/theme';

type Props = { tripId: string; embedded?: boolean };

type FilterValue = 'all' | BookingCategory;

export function TripBookingsScreen({ tripId, embedded = false }: Props) {
  const { trip } = useTripFromCache(tripId);
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');

  const load = useCallback(async () => {
    if (!tripId) {
      setError('This trip link is missing an id.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await listTripBookings(tripId, filter === 'all' ? undefined : filter);
      setBookings(result.bookings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, [filter, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(() => {
    if (filter === 'all') {
      return bookings;
    }
    return bookings.filter((row) => row.category === filter);
  }, [bookings, filter]);

  const list = (
    <>
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={[styles.header, embedded ? styles.headerEmbedded : null]}>
              <View style={styles.headerCard}>
                {embedded ? null : (
                  <Text style={styles.tripName}>{trip?.name ?? 'Trip bookings'}</Text>
                )}
                <Text style={styles.summary}>
                  {bookings.length} booking{bookings.length === 1 ? '' : 's'} · confirmations & tickets
                </Text>
                <PrimaryButton
                  label="Add booking"
                  onPress={() => router.push(`/trip/${tripId}/bookings/create` as Href)}
                />
              </View>
              <View style={styles.filters}>
                {(['all', ...BOOKING_CATEGORIES] as FilterValue[]).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setFilter(value)}
                    style={[styles.chip, filter === value ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipLabel, filter === value ? styles.chipLabelActive : null]}>
                      {value === 'all' ? 'All' : categoryLabel[value]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
            </View>
          }
          ListEmptyComponent={
            !loading && !error ? (
              <EmptyState
                title="No bookings yet"
                message="Add hotel stays, trains, flights, and tickets so everyone on the trip has them in one place."
                illustration="travel"
              />
            ) : null
          }
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onPress={() => router.push(`/trip/${tripId}/bookings/${item.id}` as Href)}
            />
          )}
        />
        {loading && bookings.length === 0 ? <Skeleton height={120} /> : null}
    </>
  );

  if (embedded) {
    return <View style={styles.embedded}>{list}</View>;
  }

  return (
    <View style={styles.root}>
      <Atmosphere />
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
        {list}
      </SafeAreaView>
    </View>
  );
}

function BookingCard({ booking, onPress }: { booking: TripBooking; onPress: () => void }) {
  const dateLabel =
    booking.endDate && booking.endDate !== booking.startDate
      ? formatDateRange(booking.startDate, booking.endDate)
      : formatDisplayDate(booking.startDate);
  const place = booking.route || booking.location;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.cardIcon}>
        <SymbolView name={categorySymbol[booking.category]} size={22} tintColor={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>{booking.title}</Text>
          <Text style={styles.statusBadge}>
            {booking.timingStatus === 'past'
              ? 'Past'
              : booking.timingStatus === 'ongoing'
                ? 'In progress'
                : 'Upcoming'}
          </Text>
        </View>
        {booking.provider ? <Text style={styles.cardMeta}>{booking.provider}</Text> : null}
        <Text style={styles.cardMeta}>{dateLabel}</Text>
        {place ? <Text style={styles.cardMeta}>{place}</Text> : null}
        <View style={styles.cardFooter}>
          <UserAvatar
            name={booking.createdBy.name}
            uri={booking.createdBy.avatarUrl}
            cacheKey={`avatar:${booking.createdBy.id}`}
            size="sm"
          />
          <Text style={styles.cardBy}>Added by {booking.createdBy.name}</Text>
          <Text style={styles.attachCount}>
            {booking.attachments.length > 0
              ? `${booking.attachments.length} file${booking.attachments.length === 1 ? '' : 's'}`
              : 'No files'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  embedded: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  list: { paddingBottom: spacing.xxl },
  header: { padding: spacing.xl, gap: spacing.md },
  headerEmbedded: { paddingTop: spacing.md },
  headerCard: { ...surfaceCard, padding: spacing.xl, gap: spacing.sm },
  tripName: { ...typography.title, fontSize: 24, color: colors.ink },
  summary: { ...typography.body, color: colors.muted },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.seafoam },
  chipLabel: { ...typography.label, color: colors.muted },
  chipLabelActive: { color: colors.primary },
  card: {
    ...surfaceCard,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  pressed: { opacity: 0.94 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.seafoam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...typography.cardTitle, color: colors.ink, flex: 1 },
  statusBadge: { ...typography.label, fontSize: 11, color: colors.primary },
  cardMeta: { ...typography.body, fontSize: 13, color: colors.muted },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  cardBy: { ...typography.body, fontSize: 12, color: colors.muted, flex: 1 },
  attachCount: { ...typography.label, fontSize: 11, color: colors.primary },
});
