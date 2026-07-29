'use strict';

const { createAutonomyScheduler, STORAGE_KEY } = require('../autonomy-scheduler');

describe('autonomy scheduler', () => {
  test('persists periodic health, evolution, and heal job records without overlapping ticks', async () => {
    const data = {};
    const storageManager = {
      safeRead: jest.fn(async (key, fallback) => data[key] || fallback),
      safeWrite: jest.fn(async (key, value) => { data[key] = value; })
    };
    let releaseHealth;
    const health = jest.fn(() => new Promise(resolve => { releaseHealth = resolve; }));
    const evolution = jest.fn(async () => ({ proposalOnly: true }));
    const heal = jest.fn(async () => ({ proposalOnly: true }));
    const scheduler = createAutonomyScheduler({
      enabled: true,
      storageManager,
      jobs: { health: 0, evolution: 0, heal: 0 },
      callbacks: { health, evolution, heal }
    });

    const first = scheduler.tick();
    await Promise.resolve();
    expect(await scheduler.tick()).toEqual({ skipped: 'locked' });
    releaseHealth({ ok: true });
    await first;

    expect(health).toHaveBeenCalledTimes(1);
    expect(evolution).toHaveBeenCalledTimes(1);
    expect(heal).toHaveBeenCalledTimes(1);
    expect(data[STORAGE_KEY]).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'health', status: 'ok' }),
      expect.objectContaining({ name: 'evolution', status: 'ok' }),
      expect.objectContaining({ name: 'heal', status: 'ok' })
    ]));
    expect(scheduler.status()).toMatchObject({ enabled: true, running: false, records: 3 });
  });

  test('defaults disabled and start only schedules enabled scheduler', () => {
    const scheduler = createAutonomyScheduler({});
    expect(scheduler.start()).toBe(false);
    expect(scheduler.status()).toMatchObject({ enabled: false, started: false });
  });

  test('keeps durable job history bounded', async () => {
    const data = { [STORAGE_KEY]: Array.from({ length: 100 }, (_, i) => ({ name: 'health', finishedAt: new Date(i).toISOString() })) };
    const scheduler = createAutonomyScheduler({
      enabled: true,
      storageManager: { safeRead: async (key, fallback) => data[key] || fallback, safeWrite: async (key, value) => { data[key] = value; } },
      jobs: { health: 0 },
      callbacks: { health: async () => ({ ok: true }) }
    });
    await scheduler.tick();
    expect(data[STORAGE_KEY]).toHaveLength(100);
  });
});
