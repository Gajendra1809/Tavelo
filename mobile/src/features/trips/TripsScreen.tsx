import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SearchField } from '@/components/SearchField';
import { SectionHeader } from '@/components/SectionHeader';
import { TripListSkeleton } from '@/components/Skeleton';
import { TripCard } from '@/components/TripCard';
import { seedTripForNavigation, useTrips } from '@/hooks/useTrips';
import { filterTripsBySearch } from '@/lib/tripSearch';
import { splitTrips } from '@/lib/tripGroups';
import type { Trip } from '@/types/trip';
import { colors, spacing, typography } from '@/theme';

export function TripsScreen() {
  const { trips, loading, refreshing, error, refresh } = useTrips();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrips = useMemo(
    () => filterTripsBySearch(trips, searchQuery),
    [trips, searchQuery],
  );
  const { upcoming, past } = useMemo(() => splitTrips(filteredTrips), [filteredTrips]);

  const searching = searchQuery.trim().length > 0;
  const showSearch = !loading && trips.length > 0;
  const noSearchResults =
    searching && !loading && !error && filteredTrips.length === 0 && trips.length > 0;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()} brandHeader>
      <Text style={styles.title}>Trips</Text>
      <PrimaryButton label="Create trip" onPress={() => router.push('/create-trip')} />
      {showSearch ? (
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by trip name or destination"
          accessibilityLabel="Search trips by name or destination"
        />
      ) : null}
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
      {noSearchResults ? (
        <EmptyState
          title="No matching trips"
          message="Try another name or destination, or clear the search to see all trips."
          illustration="travel"
        />
      ) : null}
      {upcoming.length > 0 ? (
        <>
          <SectionHeader title={searching ? 'Upcoming matches' : 'Upcoming'} />
          {upcoming.map((trip) => (
            <TripLink key={trip.id} trip={trip} />
          ))}
        </>
      ) : null}
      {past.length > 0 ? (
        <>
          <SectionHeader title={searching ? 'Past matches' : 'Past'} />
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
