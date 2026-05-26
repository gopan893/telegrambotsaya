'use strict';

const telemetryCollector = require('./telemetry-collector');
const guards = require('./ops-guards');

function getQueueStatus(services = {}) {
  try {
    const runtime = typeof services.getRuntimeStatus === 'function'
      ? services.getRuntimeStatus()
      : services.autonomousEngine?.getRuntimeStatus?.();
    return runtime?.queue || {};
  } catch (_) {
    return {};
  }
}

function getProviderStatus(services = {}) {
  const providers = {};
  const env = services.env || {};
  const breaker = services.aiCircuitBreaker;
  for (const name of ['mistral', 'groq']) {
    const configured = name === 'mistral'
      ? Boolean(env.MISTRAL_API_KEY || services.MISTRAL_API_KEY)
      : Boolean(env.GROQ_API_KEY || services.GROQ_API_KEY);
    let circuit = { open: false, failures: 0 };
    try {
      circuit = breaker?.status?.(name) || circuit;
    } catch (_) {}
    providers[name] = {
      configured,
      available: configured && !circuit.open,
      circuitOpen: Boolean(circuit.open),
      failures: Number(circuit.failures || 0)
    };
  }
  return providers;
}

function getHealth(services = {}) {
  const mem = process.memoryUsage();
  const memory = {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    externalMb: Math.round(mem.external / 1024 / 1024)
  };
  const queue = getQueueStatus(services);
  const telemetry = telemetryCollector.getTelemetrySummary(services);
  const providers = getProviderStatus(services);
  const recentErrorCount = telemetry.recentErrorCount || 0;
  const issues = [];

  if (memory.rssMb >= 480) issues.push('CRITICAL_RAM_PRESSURE');
  else if (memory.rssMb >= 360) issues.push('HIGH_RAM_USAGE');

  if (queue.maxQueueSize && queue.queuedCount >= Math.ceil(queue.maxQueueSize * 0.9)) issues.push('QUEUE_CRITICAL');
  else if (queue.maxQueueSize && queue.queuedCount >= Math.ceil(queue.maxQueueSize * 0.7)) issues.push('QUEUE_PRESSURE');

  if (recentErrorCount >= 12) issues.push('ERROR_SPIKE');
  else if (recentErrorCount >= 5) issues.push('RECENT_ERRORS');

  const providerNames = Object.keys(providers);
  const configuredProviders = providerNames.filter(name => providers[name].configured);
  const unavailableProviders = providerNames.filter(name => providers[name].configured && !providers[name].available);
  if (configuredProviders.length === 0) issues.push('NO_AI_PROVIDER_CONFIGURED');
  if (configuredProviders.length > 0 && unavailableProviders.length === configuredProviders.length) issues.push('ALL_AI_PROVIDERS_DEGRADED');

  let status = 'healthy';
  if (issues.some(item => /CRITICAL|ALL_AI|QUEUE_CRITICAL/.test(item))) status = 'critical';
  else if (issues.length) status = 'degraded';

  return {
    status,
    healthy: status === 'healthy',
    generatedAt: guards.nowIso(),
    uptimeSeconds: Math.floor(process.uptime()),
    memory,
    queue: {
      active: Number(queue.activeCount || 0),
      pending: Number(queue.queuedCount || 0),
      maxQueueSize: Number(queue.maxQueueSize || 0),
      maxConcurrency: Number(queue.maxConcurrency || 0)
    },
    providers,
    redis: {
      configured: Boolean(services.env?.REDIS_URL || services.REDIS_URL),
      status: services.redisClient ? 'available' : 'not-attached'
    },
    webhook: {
      status: services.webhookStatus || 'unknown'
    },
    recentErrorCount,
    recovery: {
      status: issues.length ? 'watch' : 'idle'
    },
    issues
  };
}

function formatHealth(health) {
  return [
    `Status: ${health.status}`,
    `Uptime: ${Math.floor((health.uptimeSeconds || 0) / 60)} menit`,
    `RAM RSS: ${health.memory.rssMb} MB`,
    `Heap: ${health.memory.heapUsedMb}/${health.memory.heapTotalMb} MB`,
    `Queue: ${health.queue.active} aktif, ${health.queue.pending}/${health.queue.maxQueueSize} antre`,
    `Recent errors: ${health.recentErrorCount}`,
    `Issues: ${health.issues.length ? health.issues.join(', ') : 'tidak ada'}`
  ].join('\n');
}

module.exports = {
  getHealth,
  formatHealth
};
