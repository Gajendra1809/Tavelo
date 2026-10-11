import { router, type Href } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Screen } from '@/components/Screen';
import { TripListSkeleton } from '@/components/Skeleton';
import { TripCard } from '@/components/TripCard';
import { seedTripForNavigation, useTrips } from '@/hooks/useTrips';
import { colors, spacing, typography } from '@/theme';

export function ExpensesHomeScreen() {
  const { trips, loading, error, refresh, refreshing } = useTrips();

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={styles.title}>Expenses</Text>
      <Text style={styles.lead}>
        Track who paid, who owes, and how to settle for each trip you belong to.
      </Text>
      {loading ? <TripListSkeleton /> : null}
      {!loading && error && trips.length === 0 ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : null}
      {!loading && !error && trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          message="Create a trip or accept an invitation, then open its expense ledger here."
          illustration="travel"
        />
      ) : null}
      {trips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onPress={() => {
            seedTripForNavigation(trip);
            router.push(`/trip/${trip.id}/expenses` as Href);
          }}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
  lead: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.md,
  },
});
