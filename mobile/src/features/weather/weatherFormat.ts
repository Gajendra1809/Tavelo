import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { TripWeatherMeta } from '@/types/weather';

export function formatTemperatureC(value: number): string {
  return `${Math.round(value)}°`;
}

export function weatherUpdateLabel(meta: TripWeatherMeta): string {
  const reference = meta.observationTime ?? meta.fetchedAt;
  const relative = formatRelativeTime(reference);
  if (meta.observationTime) {
    return `Observed ${relative}`;
  }
  return `Data updated ${relative}`;
}

export function formatHourlyTime(isoLocal: string, timeZone: string | null): string {
  const date = new Date(isoLocal);
  try {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone ?? undefined,
    });
  } catch {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
}
