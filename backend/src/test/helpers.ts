/** Unique username for integration tests (registration now requires one). */
export function uniqueTestUsername(email: string): string {
  const base =
    email
      .split('@')[0]
      ?.replace(/[^a-z0-9._]/gi, '')
      .toLowerCase()
      .slice(0, 18) || 'user';
  return `${base}_${Math.random().toString(36).slice(2, 7)}`;
}
