'use strict';

const { createOperationsMonitor } = require('../operations-monitor');

describe('operations monitor', () => {
  test('logs events, computes metrics, enforces alert rate limit, and triggers rollback', async () => {
    const alerts = [];
    const telegramMock = {
      sendMessage: jest.fn(async (chatId, text) => { alerts.push(text); })
    };

    const rollbackMock = jest.fn();
    const sandboxMock = { rollback: rollbackMock };

    const monitor = createOperationsMonitor({
      telegram: telegramMock,
      chatId: '123456',
      sandbox: sandboxMock,
      alertRateLimitMs: 50 // small rate limit for test
    });

    // 1. Log & Metric
    monitor.logEvent('info', 'System startup');
    monitor.logEvent('error', 'Database connection timeout');
    monitor.logEvent('error', 'Database connection timeout'); // duplicate

    const metrics = monitor.getMetrics();
    expect(metrics.totalEvents).toBe(3);
    expect(metrics.errors).toBe(2);

    // 2. Alert with rate limit
    await monitor.triggerAlert('Database connection timeout');
    await monitor.triggerAlert('Database connection timeout'); // rate limited!

    expect(telegramMock.sendMessage).toHaveBeenCalledTimes(1);
    expect(alerts[0]).toContain('Database connection timeout');

    // Wait and alert again
    await new Promise(resolve => setTimeout(resolve, 60));
    await monitor.triggerAlert('Database connection timeout');
    expect(telegramMock.sendMessage).toHaveBeenCalledTimes(2);

    // 3. Rollback
    await monitor.verifyDeployAndRollback({
      healthCheck: async () => false, // unhealthy
      branch: 'feature/bad-deploy'
    });
    expect(rollbackMock).toHaveBeenCalledWith('feature/bad-deploy');
  });
});
