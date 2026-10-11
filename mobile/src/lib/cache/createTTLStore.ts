export type TTLStore<T> = {
  get: () => T | null;
  getEntry: () => { value: T; fetchedAt: number } | null;
  set: (value: T) => void;
  isFresh: (ttlMs: number) => boolean;
  invalidate: () => void;
  subscribe: (listener: () => void) => () => void;
};

export function createTTLStore<T>(initial: T | null = null): TTLStore<T> {
  let value: T | null = initial;
  let fetchedAt = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    get: () => value,
    getEntry: () => (value === null ? null : { value, fetchedAt }),
    set: (next) => {
      value = next;
      fetchedAt = Date.now();
      notify();
    },
    isFresh: (ttlMs) => value !== null && Date.now() - fetchedAt < ttlMs,
    invalidate: () => {
      fetchedAt = 0;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createKeyedTTLStore<T>(): {
  get: (key: string) => T | null;
  getEntry: (key: string) => { value: T; fetchedAt: number } | null;
  set: (key: string, value: T) => void;
  isFresh: (key: string, ttlMs: number) => boolean;
  invalidate: (key: string) => void;
  invalidateAll: () => void;
  subscribe: (listener: () => void) => () => void;
} {
  const entries = new Map<string, { value: T; fetchedAt: number }>();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    get: (key) => entries.get(key)?.value ?? null,
    getEntry: (key) => entries.get(key) ?? null,
    set: (key, value) => {
      entries.set(key, { value, fetchedAt: Date.now() });
      notify();
    },
    isFresh: (key, ttlMs) => {
      const entry = entries.get(key);
      return entry !== undefined && Date.now() - entry.fetchedAt < ttlMs;
    },
    invalidate: (key) => {
      entries.delete(key);
      notify();
    },
    invalidateAll: () => {
      entries.clear();
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
