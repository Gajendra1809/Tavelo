import { router, type Href } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TripListSkeleton } from '@/components/Skeleton';
import { TripCard } from '@/components/TripCard';
import { seedTripForNavigation, useTrips } from '@/hooks/useTrips';
import { splitTrips } from '@/lib/tripGroups';
import type { Trip } from '@/types/trip';
import { colors, spacing, typography } from '@/theme';

export function TripsScreen() {
  const { trips, loading, refreshing, error, refresh } = useTrips();
  const { upcoming, past } = splitTrips(trips);

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()} brandHeader>
      <Text style={styles.title}>Trips</Text>
      <PrimaryButton label="Create trip" onPress={() => router.push('/create-trip')} />
      {loading ? <TripListSkeleton /> : null}
      {!loading && error && trips.length === 0 ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : null}
      {!loading && !error && trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          message="Create a trip with a destination and dates. It will be saved and listed here."
          illustration="travel"
        />
      ) : null}
      {upcoming.length > 0 ? (
        <>
          <SectionHeader title="Upcoming" />
          {upcoming.map((trip) => (
            <TripLink key={trip.id} trip={trip} />
          ))}
        </>
      ) : null}
      {past.length > 0 ? (
        <>
          <SectionHeader title="Past" />
          {past.map((trip) => (
            <TripLink key={trip.id} trip={trip} />
          ))}
        </>
      ) : null}
      {!loading && error && trips.length > 0 ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : null}
    </Screen>
  );
}

function TripLink({ trip }: { trip: Trip }) {
  return (
    <TripCard
      trip={trip}
      onPress={() => {
        seedTripForNavigation(trip);
        router.push(`/trip/${trip.id}` as Href);
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
});
