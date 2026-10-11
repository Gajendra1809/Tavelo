export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) {
    return 'Just now';
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 48) {
    return `${diffHour}h ago`;
  }
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 14) {
    return `${diffDay}d ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
