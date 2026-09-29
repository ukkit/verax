/**
 * A sliding-window pacer: at most `max` calls may start in any `windowMs`. `acquire()` resolves at once while there is room
 * and otherwise waits until the oldest call leaves the window. Callers are served in the order they asked.
 */
export function createLimiter(
  max: number,
  windowMs: number,
  now: () => number = () => Date.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): () => Promise<void> {
  const starts: number[] = [];
  let queue: Promise<void> = Promise.resolve();
  return () => {
    const turn = queue.then(async () => {
      for (;;) {
        const t = now();
        while (starts.length > 0 && starts[0]! <= t - windowMs) starts.shift();
        if (starts.length < max) {
          starts.push(t);
          return;
        }
        await sleep(starts[0]! + windowMs - t);
      }
    });
    queue = turn;
    return turn;
  };
}
