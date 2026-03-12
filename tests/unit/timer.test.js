import { describe, it, expect } from 'vitest';

const { startTimer } = require('../../src/utils/timer');

describe('startTimer', () => {
  it('returns elapsed time', async () => {
    const timer = startTimer();
    await new Promise((r) => setTimeout(r, 50));
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow some variance
    expect(elapsed).toBeLessThan(200);
  });

  it('can be called multiple times', async () => {
    const timer = startTimer();
    const t1 = timer.elapsed();
    await new Promise((r) => setTimeout(r, 30));
    const t2 = timer.elapsed();
    expect(t2).toBeGreaterThan(t1);
  });
});
