/**
 * Wraps an async loader so each key loads at most once per `ttlMs`. Callers that ask for the
 * same key at the same moment share one request. A failed load is forgotten, so the next call
 * tries again.
 *
 * Args:
 *   load: Loads the value for one key.
 *   ttlMs: How long a loaded value is reused, in milliseconds.
 *   now: Clock in milliseconds (tests pass their own).
 *
 * Returns:
 *   A function with the same signature as `load`.
 */
export function memoByKey<T>(
  load: (key: string) => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): (key: string) => Promise<T> {
  const entries = new Map<string, { value: Promise<T>; expires: number }>();

  return (key) => {
    const entry = entries.get(key);
    if (entry && entry.expires > now()) return entry.value;
    const value = load(key);
    entries.set(key, { value, expires: now() + ttlMs });
    value.catch(() => {
      // Only forget this attempt, not a newer one started after it.
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
}
