'use strict';

const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');

function registerMonitoringRoutes(router, services = {}) {
  const monitoring = services.monitoringSystem;
  if (!monitoring) return;

  async function ensureAccess(req, res) {
    if (!guards.validateDashboardAccess(req)) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'UNAUTHORIZED' }, 401);
    }
    return true;
  }

  router.get('/monitoring/snapshot', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const snapshot = monitoring.realtimeHealth.getSnapshot();
    const eventCount = monitoring.eventBus.getHistory().length;
    return guards.safeDashboardResponse(res, {
      ok: true,
      eventCount,
      wsClients: monitoring.wsServer.getClientCount(),
      wsFallback: monitoring.wsServer.fallbackActive,
      metrics: monitoring.metricsStore.snapshot(),
      recentEvents: snapshot.events
    });
  });

  router.get('/monitoring/events', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const filter = {};
    if (req.query.topic) filter.topic = req.query.topic;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.source) filter.source = req.query.source;
    const events = monitoring.eventBus.getHistory(Object.keys(filter).length > 0 ? filter : null);
    return guards.safeDashboardResponse(res, { ok: true, events: events.slice(-100).reverse() });
  });

  router.post('/monitoring/emit', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const { topic, severity, title, summary } = req.body || {};
    if (!topic) return guards.safeDashboardResponse(res, { ok: false, error: 'topic required' }, 400);
    const event = monitoring.emit(topic || 'health', severity || 'info', title || 'Dashboard event', summary || '');
    return guards.safeDashboardResponse(res, { ok: true, event });
  });

  router.get('/monitoring/metrics', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    return guards.safeDashboardResponse(res, { ok: true, metrics: monitoring.metricsStore.getAll() });
  });

  router.get('/monitoring/ws-clients', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    return guards.safeDashboardResponse(res, { ok: true, count: monitoring.wsServer.getClientCount(), fallback: monitoring.wsServer.fallbackActive });
  });
}

module.exports = { registerMonitoringRoutes };
