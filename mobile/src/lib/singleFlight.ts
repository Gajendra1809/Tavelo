export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;

  return () => {
    if (!pending) {
      pending = fn().finally(() => {
        pending = null;
      });
    }
    return pending;
  };
}
