'use strict';

const assert = require('assert');
const monitor = require('../src/observability/production-health-monitor');

const services = {
  env: { DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'set', TELEGRAM_TOKEN: 'set', WEBHOOK_URL: 'https://example.test' },
  storageManager: {
    getStorageStatus: () => ({
      activeDriver: 'postgres',
      postgresAvailable: true,
      postgresTableReady: true,
      redisUrlConfigured: true,
      redisAvailable: true,
      redisStatus: 'connected'
    })
  },
  evaluationSystem: { runEvalCases: () => ({ approvalSafetyScore: 100 }) },
  executorSystem: require('../src/executor')
};

(async () => {
  const health = await monitor.runProductionHealthCheck(services);
  assert(['healthy', 'degraded', 'unhealthy', 'unknown'].includes(health.status), 'health status valid');
  assert(Array.isArray(health.checks), 'checks array exists');
  assert(!JSON.stringify(health).includes('postgresql://'), 'no database url leak');
  console.log('test-production-health-monitor: ok');
})();
