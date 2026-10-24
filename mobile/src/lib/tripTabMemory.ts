const RETURN_WINDOW_MS = 5 * 60 * 1000;

type RememberedTab = {
  tab: string;
  at: number;
};

const lastTabByTrip = new Map<string, RememberedTab>();

export function rememberTripTab(tripId: string, tab: string): void {
  if (!tripId || !tab) {
    return;
  }
  lastTabByTrip.set(tripId, { tab, at: Date.now() });
}

export function readTripTab(tripId: string | undefined): string | undefined {
  if (!tripId) {
    return undefined;
  }
  const remembered = lastTabByTrip.get(tripId);
  if (!remembered) {
    return undefined;
  }
  if (Date.now() - remembered.at > RETURN_WINDOW_MS) {
    lastTabByTrip.delete(tripId);
    return undefined;
  }
  return remembered.tab;
}
