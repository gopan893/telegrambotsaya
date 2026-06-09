'use strict';

const utils = require('./reliability-utils');
const postReleaseMonitor = require('./post-release-monitor');

function createInitialStore() {
  return { windows: [] };
}

let store = createInitialStore();
function resetStore() { store = createInitialStore(); return store; }

const ReleaseHealthWindow = {
  openReleaseHealthWindow(releaseId, duration = 30, services = {}) {
    const w = {
      id: utils.generateId('hlw'),
      releaseId,
      status: 'open',
      durationMinutes: duration,
      startedAt: utils.formatTimestamp(),
      closedAt: null,
      samples: [],
      summary: null
    };
    store.windows.push(w);
    return w;
  },

  recordHealthSample(releaseId, sample = {}, services = {}) {
    const w = store.windows.find(win => win.releaseId === releaseId && win.status === 'open');
    if (!w) return { ok: false, error: 'No open health window' };
    const s = {
      timestamp: utils.formatTimestamp(),
      uptime: utils.safeNumber(sample.uptime, 99.5),
      latency: utils.safeNumber(sample.latency, 100),
      telegramCommandSuccess: sample.telegramCommandSuccess !== false,
      dashboardApiSuccess: sample.dashboardApiSuccess !== false,
      webhookStatus: sample.webhookStatus !== 'down',
      dbStatus: sample.dbStatus !== 'down',
      redisStatus: sample.redisStatus !== 'down',
      errors: utils.safeNumber(sample.errors, 0),
      incidents: utils.safeNumber(sample.incidents, 0),
      userRegressions: utils.safeNumber(sample.userRegressions, 0),
      deployStatus: sample.deployStatus || 'stable'
    };
    w.samples.push(s);
    return { ok: true, sample: s };
  },

  summarizeHealthWindow(releaseId, services = {}) {
    const w = store.windows.find(win => win.releaseId === releaseId);
    if (!w || w.samples.length === 0) return { status: 'no_data' };
    const samples = w.samples;
    const avgUptime = samples.reduce((s, sm) => s + (sm.uptime || 0), 0) / samples.length;
    const avgLatency = samples.reduce((s, sm) => s + (sm.latency || 0), 0) / samples.length;
    const totalErrors = samples.reduce((s, sm) => s + (sm.errors || 0), 0);
    const totalIncidents = samples.reduce((s, sm) => s + (sm.incidents || 0), 0);
    const totalRegressions = samples.reduce((s, sm) => s + (sm.userRegressions || 0), 0);
    const healthy = totalErrors === 0 && totalIncidents === 0 && totalRegressions === 0;

    w.summary = {
      status: healthy ? 'healthy' : 'degraded',
      avgUptime: Math.round(avgUptime * 10) / 10,
      avgLatency: Math.round(avgLatency),
      totalErrors,
      totalIncidents,
      totalRegressions,
      sampleCount: samples.length,
      durationMinutes: w.durationMinutes,
      allTelegramOk: samples.every(s => s.telegramCommandSuccess),
      allDashboardOk: samples.every(s => s.dashboardApiSuccess),
      allWebhookOk: samples.every(s => s.webhookStatus !== 'down'),
      allDbOk: samples.every(s => s.dbStatus !== 'down')
    };
    return w.summary;
  },

  closeReleaseHealthWindow(releaseId, services = {}) {
    const w = store.windows.find(win => win.releaseId === releaseId && win.status === 'open');
    if (!w) return { ok: false, error: 'No open health window' };
    const summary = this.summarizeHealthWindow(releaseId, services);
    w.status = 'closed';
    w.closedAt = utils.formatTimestamp();
    w.summary = summary;
    return { ok: true, window: w, summary };
  },

  getStore() { return store; }
};

module.exports = ReleaseHealthWindow;
