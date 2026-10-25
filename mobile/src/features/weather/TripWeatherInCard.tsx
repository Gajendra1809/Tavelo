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

type TripWeatherSummaryRowProps = {
  weather: WeatherController;
  tripStartDate: string;
  tripEndDate: string;
};

/** Single glass chip for the trip hero. Details stay in the weather sheet. */
export function TripWeatherChip({
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
      <View style={styles.chipSkeleton}>
        <Skeleton height={32} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Retry weather" onPress={retry} style={styles.chip}>
        <Text style={styles.chipMuted}>Weather unavailable · Retry</Text>
      </Pressable>
    );
  }

  if (state.status === 'unavailable') {
    if (state.response.reason === 'manual_location') {
      return null;
    }
    return (
      <View style={styles.chip}>
        <Text style={styles.chipMuted} numberOfLines={1}>
          {state.response.message}
        </Text>
      </View>
    );
  }

  const data: TripWeatherData = state.data;
  const refreshing = state.status === 'refreshing';
  const feels =
    data.current.apparentTemperatureC != null
      ? `Feels ${formatTemperatureC(data.current.apparentTemperatureC)}`
      : null;

  return (
    <>
      <View style={styles.chip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${data.current.conditionLabel}, ${formatTemperatureC(data.current.temperatureC)}. Open weather details.`}
          onPress={() => setDetailVisible(true)}
          style={styles.chipMain}
        >
          <Text style={styles.chipIcon}>{data.current.conditionIcon}</Text>
          <Text style={styles.chipTemp}>{formatTemperatureC(data.current.temperatureC)}</Text>
          <Text style={styles.chipCondition} numberOfLines={1}>
            {data.current.conditionLabel}
            {feels ? ` · ${feels}` : ''}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh weather"
          hitSlop={8}
          disabled={refreshing}
          onPress={() => refresh()}
          style={styles.chipRefresh}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <SymbolView
              name={{ android: 'refresh', web: 'refresh' }}
              size={16}
              tintColor={colors.primary}
            />
          )}
        </Pressable>
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 36,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    gap: spacing.xs,
  },
  chipSkeleton: {
    width: 148,
    borderRadius: 18,
    overflow: 'hidden',
  },
  chipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    minHeight: 36,
    paddingVertical: spacing.xs,
  },
  chipIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  chipTemp: {
    ...typography.label,
    fontSize: 15,
    color: colors.ink,
  },
  chipCondition: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    flexShrink: 1,
  },
  chipMuted: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  chipRefresh: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
