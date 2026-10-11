export const PROFILE_TTL_MS = 120_000;

let lastFetchedAt: number | null = null;

export const profileCache = {
  isFresh(): boolean {
    if (lastFetchedAt === null) {
      return false;
    }
    return Date.now() - lastFetchedAt < PROFILE_TTL_MS;
  },
  markFetched(): void {
    lastFetchedAt = Date.now();
  },
  invalidate(): void {
    lastFetchedAt = null;
  },
};
