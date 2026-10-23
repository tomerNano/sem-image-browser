export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** Run at most `n` tasks at the same time; the rest wait in order. */
export function createLimiter(n: number): Limiter {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= n) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
