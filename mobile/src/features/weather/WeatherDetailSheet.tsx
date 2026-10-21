import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { formatHourlyTime, formatTemperatureC, weatherUpdateLabel } from '@/features/weather/weatherFormat';
import type { TripWeatherData } from '@/types/weather';
import { colors, spacing, typography } from '@/theme';

type WeatherDetailSheetProps = {
  visible: boolean;
  onClose: () => void;
  data: TripWeatherData;
  tripStartDate: string;
  tripEndDate: string;
};

export function WeatherDetailSheet({
  visible,
  onClose,
  data,
  tripStartDate,
  tripEndDate,
}: WeatherDetailSheetProps) {
  const { current, daily, hourly, meta } = data;
  const tripStart = new Date(`${tripStartDate}T12:00:00`);
  const referenceMs = new Date(meta.fetchedAt).getTime();
  const daysUntilTrip = Math.ceil((tripStart.getTime() - referenceMs) / (24 * 60 * 60 * 1000));
  const forecastNote =
    daysUntilTrip > 14
      ? 'Trip dates are beyond the reliable forecast window. Current conditions at the destination are shown below; a forecast for your travel dates is not available yet.'
      : null;

  return (
    <BottomFormSheet visible={visible} onClose={onClose} title="Destination weather">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.currentRow}>
          <Text style={styles.currentIcon}>{current.conditionIcon}</Text>
          <View style={styles.currentCopy}>
            <Text style={styles.currentTemp}>{formatTemperatureC(current.temperatureC)}</Text>
            <Text style={styles.currentLabel}>{current.conditionLabel}</Text>
            {current.apparentTemperatureC != null ? (
              <Text style={styles.feelsLike}>
                Feels like {formatTemperatureC(current.apparentTemperatureC)}
              </Text>
            ) : null}
          </View>
        </View>
        {daily ? (
          <Text style={styles.daily}>
            Today {formatTemperatureC(daily.lowC)} – {formatTemperatureC(daily.highC)}
          </Text>
        ) : null}
        <Text style={styles.updated}>
          {weatherUpdateLabel(meta)}
          {meta.isStale ? ' · Cached' : ''}
        </Text>
        {forecastNote ? <Text style={styles.note}>{forecastNote}</Text> : null}
        <Text style={styles.sectionTitle}>Next hours</Text>
        <View style={styles.hourlyList}>
          {hourly.map((point) => (
            <View key={point.time} style={styles.hourlyRow}>
              <Text style={styles.hourlyTime}>
                {formatHourlyTime(point.time, meta.timezone)}
              </Text>
              <Text style={styles.hourlyIcon}>{point.conditionIcon}</Text>
              <Text style={styles.hourlyTemp}>{formatTemperatureC(point.temperatureC)}</Text>
              {point.precipitationProbability != null ? (
                <Text style={styles.hourlyRain}>{point.precipitationProbability}% rain</Text>
              ) : (
                <Text style={styles.hourlyRain}> </Text>
              )}
            </View>
          ))}
        </View>
        <Text style={styles.attribution}>
          {meta.attribution} · Trip dates {tripStartDate} – {tripEndDate}
        </Text>
      </ScrollView>
    </BottomFormSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  currentIcon: {
    fontSize: 40,
    lineHeight: 48,
  },
  currentCopy: {
    gap: spacing.xs,
    flex: 1,
  },
  currentTemp: {
    ...typography.title,
    fontSize: 36,
    color: colors.ink,
  },
  currentLabel: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
  },
  feelsLike: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
  },
  daily: {
    ...typography.body,
    color: colors.muted,
  },
  updated: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
  },
  note: {
    ...typography.body,
    fontSize: 14,
    color: colors.warning,
    backgroundColor: colors.warningSurface,
    padding: spacing.md,
    borderRadius: 12,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  hourlyList: {
    gap: spacing.sm,
  },
  hourlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
  },
  hourlyTime: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
    width: 72,
  },
  hourlyIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  hourlyTemp: {
    ...typography.label,
    color: colors.ink,
    width: 44,
  },
  hourlyRain: {
    ...typography.body,
    fontSize: 13,
    color: colors.muted,
    flex: 1,
    textAlign: 'right',
  },
  attribution: {
    ...typography.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: spacing.md,
  },
});
