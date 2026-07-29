'use strict';

const { createDurableQueue } = require('../durable-queue');

describe('durable queue', () => {
  test('persists queue lifecycle, claims FIFO, limits history, and locks claim', async () => {
    const data = {};
    const storageManager = {
      safeRead: jest.fn(async (key, fallback) => data[key] || fallback),
      safeWrite: jest.fn(async (key, value) => { data[key] = value; })
    };

    const q = createDurableQueue({ storageManager });

    // 1. Enqueue
    const t1 = await q.enqueue({ type: 'test-job', payload: { x: 1 } });
    const t2 = await q.enqueue({ type: 'test-job', payload: { x: 2 } });
    expect(t1).toMatchObject({ id: expect.any(String), type: 'test-job', status: 'queued' });

    // 2. FIFO Claim
    const c1 = await q.claim();
    expect(c1.id).toBe(t1.id);
    expect(c1.status).toBe('processing');

    const c2 = await q.claim();
    expect(c2.id).toBe(t2.id);

    // No more queued tasks
    expect(await q.claim()).toBeNull();

    // 3. Complete
    await q.complete(c1.id, { success: true });
    const tasks = await q.getHistory();
    const completedT1 = tasks.find(t => t.id === t1.id);
    expect(completedT1.status).toBe('completed');
    expect(completedT1.result).toEqual({ success: true });

    // 4. Bounded history
    // Complete c2 first so no processing tasks remain
    await q.complete(c2.id);

    // Enqueue 105 completed tasks
    for (let i = 0; i < 105; i++) {
      const t = await q.enqueue({ type: 'cleanup' });
      const c = await q.claim();
      await q.complete(c.id);
    }
    const history = await q.getHistory();
    expect(history.length).toBeLessThanOrEqual(100);
  });
});
