import { describe, expect, it } from 'vitest';
import { createLimiter } from './rateLimit';

/** A clock the test moves by hand: sleeping advances it instead of waiting. */
function fakeClock() {
  let t = 0;
  const slept: number[] = [];
  return { now: () => t, sleep: async (ms: number) => { slept.push(ms); t += ms; }, slept, advance: (ms: number) => { t += ms; } };
}

describe('createLimiter', () => {
  it('lets calls through without waiting while there is room', async () => {
    const clock = fakeClock();
    const acquire = createLimiter(3, 1000, clock.now, clock.sleep);
    await Promise.all([acquire(), acquire(), acquire()]);
    expect(clock.slept).toEqual([]);
  });

  it('waits until the oldest call leaves the window when it is full', async () => {
    const clock = fakeClock();
    const acquire = createLimiter(2, 1000, clock.now, clock.sleep);
    await acquire();
    clock.advance(300);
    await acquire();
    await acquire(); // the window holds calls from t=0 and t=300; the first leaves at t=1000
    expect(clock.slept).toEqual([700]);
    expect(clock.now()).toBe(1000);
  });

  it('never has more than max calls start within one window, over a long run', async () => {
    const clock = fakeClock();
    const acquire = createLimiter(5, 1000, clock.now, clock.sleep);
    const starts: number[] = [];
    await Promise.all(Array.from({ length: 23 }, async () => { await acquire(); starts.push(clock.now()); }));
    for (const start of starts) expect(starts.filter((s) => s >= start && s < start + 1000).length).toBeLessThanOrEqual(5);
    expect(clock.now()).toBeGreaterThanOrEqual(4000); // 23 calls at 5 a second cannot finish before 4 whole windows
  });

  it('serves callers in the order they asked', async () => {
    const clock = fakeClock();
    const acquire = createLimiter(1, 100, clock.now, clock.sleep);
    const order: number[] = [];
    await Promise.all([1, 2, 3, 4].map(async (n) => { await acquire(); order.push(n); }));
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('forgets calls that are older than the window', async () => {
    const clock = fakeClock();
    const acquire = createLimiter(1, 1000, clock.now, clock.sleep);
    await acquire();
    clock.advance(1500);
    await acquire();
    expect(clock.slept).toEqual([]);
  });
});
