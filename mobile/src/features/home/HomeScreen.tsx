import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TripListSkeleton } from '@/components/Skeleton';
import { TripCard } from '@/components/TripCard';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTrips } from '@/hooks/useTrips';
import { splitTrips } from '@/lib/tripGroups';
import { colors, spacing, typography } from '@/theme';

export function HomeScreen() {
  const { user } = useAuth();
  const { trips, loading, refreshing, error, refresh } = useTrips();
  const { upcoming } = splitTrips(trips);
  const firstName = user?.name.trim().split(/\s+/)[0];

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <View style={styles.intro}>
        <View style={styles.introRow}>
          <UserAvatar name={user?.name ?? 'Traveler'} size="sm" />
          <View style={styles.introCopy}>
            <Text style={styles.greeting}>{firstName ? `Hello, ${firstName}` : 'Hello'}</Text>
            <Text style={styles.description}>
              Plan a trip, then keep the dates and destination together for the group.
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.plan}>
        <Text style={styles.planTitle}>Where to next?</Text>
        <PrimaryButton label="Plan a trip" onPress={() => router.push('/create-trip')} />
      </View>
      <SectionHeader
        title="Upcoming trips"
        actionLabel={upcoming.length > 0 ? 'See all' : undefined}
        onAction={upcoming.length > 0 ? () => router.push('/trips') : undefined}
      />
      {loading ? <TripListSkeleton /> : null}
      {!loading && error && trips.length === 0 ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : null}
      {!loading && !error && upcoming.length === 0 ? (
        <EmptyState
          title="No upcoming trips"
          message="When you create a trip, it will show up here with its destination and dates."
          illustration="travel"
        />
      ) : null}
      {upcoming.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onPress={() => router.push(`/trip/${trip.id}` as Href)}
        />
      ))}
      {!loading && error && trips.length > 0 ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.sm,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  introCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  greeting: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
  description: {
    ...typography.body,
    color: colors.muted,
  },
  plan: {
    gap: spacing.md,
  },
  planTitle: {
    ...typography.cardTitle,
    fontSize: 20,
    color: colors.ink,
  },
});
