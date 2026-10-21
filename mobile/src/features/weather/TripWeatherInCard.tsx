import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Skeleton } from '@/components/Skeleton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { WeatherDetailSheet } from '@/features/weather/WeatherDetailSheet';
import type { useTripWeather } from '@/features/weather/useTripWeather';
import {
  formatTemperatureC,
  weatherUpdateLabel,
} from '@/features/weather/weatherFormat';
import type { TripWeatherData } from '@/types/weather';
import { colors, spacing, typography } from '@/theme';

type WeatherController = ReturnType<typeof useTripWeather>;

export function TripWeatherHeaderBadge({ weather }: { weather: WeatherController }) {
  const { eligible, state } = weather;
  if (!eligible) {
    return null;
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <View style={styles.headerSkeleton}>
        <Skeleton height={28} />
      </View>
    );
  }
  const data =
    state.status === 'ready' || state.status === 'refreshing' ? state.data : null;
  if (!data) {
    return null;
  }
  return (
    <View style={styles.headerBadge} accessibilityLabel="Current destination weather">
      <Text style={styles.headerIcon}>{data.current.conditionIcon}</Text>
      <Text style={styles.headerTemp}>{formatTemperatureC(data.current.temperatureC)}</Text>
    </View>
  );
}

type TripWeatherSummaryRowProps = {
  weather: WeatherController;
  tripStartDate: string;
  tripEndDate: string;
};

export function TripWeatherSummaryRow({
  weather,
  tripStartDate,
  tripEndDate,
}: TripWeatherSummaryRowProps) {
  const { eligible, state, refresh, retry } = weather;
  const [detailVisible, setDetailVisible] = useState(false);

  if (!eligible) {
    return null;
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <View style={styles.weatherBlock}>
        <View style={styles.divider} />
        <Skeleton height={52} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.weatherBlock}>
        <View style={styles.divider} />
        <View style={styles.unavailableRow}>
          <Text style={styles.unavailableText}>Weather unavailable</Text>
          <SecondaryButton label="Retry" onPress={retry} />
        </View>
      </View>
    );
  }

  if (state.status === 'unavailable') {
    if (state.response.reason === 'manual_location') {
      return null;
    }
    return (
      <View style={styles.weatherBlock}>
        <View style={styles.divider} />
        <View style={styles.unavailableRow}>
          <Text style={styles.unavailableText}>{state.response.message}</Text>
        </View>
      </View>
    );
  }

  const data: TripWeatherData =
    state.status === 'ready' || state.status === 'refreshing' ? state.data : null!;
  const refreshing = state.status === 'refreshing';

  return (
    <>
      <View style={styles.weatherBlock}>
        <View style={styles.divider} />
        <View style={styles.summaryPress}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open weather details"
            onPress={() => setDetailVisible(true)}
            style={({ pressed }) => [pressed ? styles.pressed : null]}
          >
            <View style={styles.summaryTop}>
              <View style={styles.summaryMain}>
                <Text style={styles.summaryIcon}>{data.current.conditionIcon}</Text>
                <Text style={styles.summaryCondition} numberOfLines={2}>
                  {data.current.conditionLabel}
                </Text>
              </View>
              {data.current.apparentTemperatureC != null ? (
                <Text style={styles.feelsLike} numberOfLines={1}>
                  Feels like {formatTemperatureC(data.current.apparentTemperatureC)}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.summaryBottom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open weather details"
              onPress={() => setDetailVisible(true)}
              style={({ pressed }) => [styles.updatedPress, pressed ? styles.pressed : null]}
            >
              <Text style={styles.updated} numberOfLines={2}>
                {weatherUpdateLabel(data.meta)}
                {data.meta.isStale ? ' · Cached' : ''}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh weather"
              hitSlop={8}
              disabled={refreshing}
              onPress={() => refresh()}
              style={styles.refreshBtn}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <SymbolView
                  name={{ android: 'refresh', web: 'refresh' }}
                  size={18}
                  tintColor={colors.primary}
                />
              )}
            </Pressable>
          </View>
        </View>
      </View>
      <WeatherDetailSheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        data={data}
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerSkeleton: {
    width: 72,
    borderRadius: 14,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.seafoam,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '42%',
  },
  headerIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  headerTemp: {
    ...typography.label,
    color: colors.primary,
    fontSize: 16,
  },
  weatherBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginTop: spacing.xs,
  },
  summaryPress: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  pressed: {
    opacity: 0.92,
  },
  summaryTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 120,
  },
  summaryIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  summaryCondition: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
    flexShrink: 1,
  },
  feelsLike: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  summaryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  updatedPress: {
    flex: 1,
  },
  updated: {
    ...typography.body,
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  refreshBtn: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableRow: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  unavailableText: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
});
