type TypingEntry = { userId: string; expiresAt: number };

const TYPING_TTL_MS = 5_000;
const typingByTrip = new Map<string, Map<string, TypingEntry>>();

export function markTyping(tripId: string, userId: string): void {
  const now = Date.now();
  const trip = typingByTrip.get(tripId) ?? new Map<string, TypingEntry>();
  trip.set(userId, { userId, expiresAt: now + TYPING_TTL_MS });
  typingByTrip.set(tripId, trip);
}

export function listTypingUserIds(tripId: string, exceptUserId?: string): string[] {
  const trip = typingByTrip.get(tripId);
  if (!trip) {
    return [];
  }
  const now = Date.now();
  const active: string[] = [];
  for (const [userId, entry] of trip) {
    if (entry.expiresAt <= now) {
      trip.delete(userId);
      continue;
    }
    if (exceptUserId && userId === exceptUserId) {
      continue;
    }
    active.push(userId);
  }
  if (trip.size === 0) {
    typingByTrip.delete(tripId);
  }
  return active;
}
