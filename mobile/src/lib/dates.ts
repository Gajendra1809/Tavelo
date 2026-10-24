export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function todayDateInput(now = new Date()): string {
  return formatDateInput(now);
}

export function formatDisplayDate(value: string): string {
  return parseDateInput(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return formatDisplayDate(start);
  }
  return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
}

export function tripLengthDays(start: string, end: string): number {
  const startUtc = dateOnlyUtc(start);
  const endUtc = dateOnlyUtc(end);
  return Math.round((endUtc - startUtc) / 86_400_000) + 1;
}

export function formatTripLength(start: string, end: string): string {
  const days = tripLengthDays(start, end);
  if (!Number.isFinite(days) || days < 1) {
    return '';
  }
  return days === 1 ? '1 day' : `${days} days`;
}

function dateOnlyUtc(value: string): number {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function enumerateDateRange(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = dateOnlyUtc(start);
  const last = dateOnlyUtc(end);
  while (cursor <= last) {
    days.push(msToDateOnly(cursor));
    cursor += 86_400_000;
  }
  return days;
}

export function formatDayTab(value: string): string {
  return parseDateInput(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatTimeInput(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function defaultTimeDate(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function parseTimeInput(value: string): Date {
  const [hourPart, minutePart] = value.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  return defaultTimeDate(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
}

export function formatDisplayTime(value: string): string {
  return parseTimeInput(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isClockTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }
  const [hour, minute] = value.split(':').map((part) => Number(part));
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function normalizeOptionalTime(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function displayClock(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return isClockTime(value) ? formatDisplayTime(value) : value;
}

export function formatActivityTime(start: string | null, end: string | null): string {
  const startLabel = displayClock(start);
  const endLabel = displayClock(end);
  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }
  if (startLabel) {
    return startLabel;
  }
  if (endLabel) {
    return `Until ${endLabel}`;
  }
  return 'Flexible';
}

function msToDateOnly(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
