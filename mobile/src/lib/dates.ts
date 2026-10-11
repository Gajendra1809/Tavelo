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
  return parseDateInput(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
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
  return parseDateInput(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatActivityTime(start: string | null, end: string | null): string {
  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return start;
  }
  if (end) {
    return `Until ${end}`;
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
