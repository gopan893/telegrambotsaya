'use strict';

const { createOperationsMonitor } = require('../operations-monitor');

describe('operations monitor', () => {
  test('logs events, redacts secrets, computes metrics, enforces alert rate limit, and triggers rollback', async () => {
    const alerts = [];
    const telegramMock = {
      sendMessage: jest.fn(async (chatId, text) => { alerts.push(text); })
    };

    const rollbackMock = jest.fn();
    const sandboxMock = { rollback: rollbackMock };

    let currentTime = 1000000;
    const now = () => currentTime;

    const monitor = createOperationsMonitor({
      telegram: telegramMock,
      chatId: '123456',
      sandbox: sandboxMock,
      alertRateLimitMs: 5000,
      now
    });

    // 1. Log & Metric & Redacting secrets
    monitor.logEvent('info', 'System startup');
    monitor.logEvent('error', 'DB connection error for token 1234567890:abcdefghijklmnopqrstuvwxyz123456789');
    monitor.logEvent('error', 'Key failure', { apiKey: 'secret-key-123' });

    const metrics = monitor.getMetrics();
    expect(metrics.totalEvents).toBe(3);
    expect(metrics.errors).toBe(2);
    expect(metrics.recentErrors).toBe(2);

    // Verify redactions
    expect(alerts.length).toBe(0);
    
    // 2. Alert with fingerprint rate limit
    await monitor.triggerAlert('db_timeout', 'Database connection timeout');
    await monitor.triggerAlert('db_timeout', 'Database connection timeout'); // rate limited!

    expect(telegramMock.sendMessage).toHaveBeenCalledTimes(1);
    expect(alerts[0]).toContain('Database connection timeout');

    // Fast-forward time past 5 seconds rate limit
    currentTime += 6000;
    await monitor.triggerAlert('db_timeout', 'Database connection timeout');
    expect(telegramMock.sendMessage).toHaveBeenCalledTimes(2);

    // 3. Rollback
    await monitor.verifyDeployAndRollback({
      healthCheck: async () => false, // unhealthy
      branch: 'feature/bad-deploy'
    });
    expect(rollbackMock).toHaveBeenCalledWith('feature/bad-deploy');
  });
});
