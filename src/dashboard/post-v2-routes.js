'use strict';

const store = require('../post-v2/post-v2-watch-store');
const utils = require('../post-v2/post-v2-utils');
const watchMgr = require('../post-v2/post-v2-watch-manager');
const healthWindow = require('../post-v2/post-v2-health-window');
const regressionWatchdog = require('../post-v2/post-v2-regression-watchdog');
const dashboardWatchdog = require('../post-v2/post-v2-dashboard-watchdog');
const apiWatchdog = require('../post-v2/post-v2-api-watchdog');
const telegramWatchdog = require('../post-v2/post-v2-telegram-watchdog');
const pwaWatchdog = require('../post-v2/post-v2-pwa-watchdog');
const perfWatchdog = require('../post-v2/post-v2-performance-watchdog');
const secWatchdog = require('../post-v2/post-v2-security-privacy-watchdog');
const rollbackAdvisor = require('../post-v2/post-v2-rollback-advisor');
const relScorecard = require('../post-v2/post-v2-reliability-scorecard');

function _sanitize(obj) {
  return utils.sanitizeForReport(obj);
}

function _authRequired(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.query && req.query.token) {
    const env = req.app?.locals?.dashboardEnv || process.env;
    const adminToken = env.DASHBOARD_ADMIN_TOKEN || '';
    if (req.query.token === adminToken) return next();
  }
  return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
}

function registerPostV2Routes(app, services = {}) {
  app.get('/api/dashboard/post-v2', _authRequired, async (req, res) => {
    try {
      const watches = store.getAllPostV2Watches();
      const latest = watches.length > 0 ? watches[watches.length - 1] : null;
      const sanitized = latest ? _sanitize({
        id: latest.id,
        status: latest.status,
        version: latest.version,
        workspaceId: latest.workspaceId,
        releaseId: latest.releaseId,
        healthWindow: latest.healthWindow ? { id: latest.healthWindow.id, status: latest.healthWindow.status } : null,
        dashboardStatus: latest.dashboardStatus,
        apiStatus: latest.apiStatus,
        telegramStatus: latest.telegramStatus,
        pwaStatus: latest.pwaStatus,
        performanceStatus: latest.performanceStatus,
        securityStatus: latest.securityStatus,
        privacyStatus: latest.privacyStatus,
        incidents: (latest.incidents || []).length,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt
      }) : null;
      res.json({ ok: true, status: latest ? latest.status : 'empty', data: sanitized });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/post-v2/start', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const watch = await watchMgr.startPostV2Watch(input, services);
      const safe = _sanitize(watch);
      res.json({ ok: true, status: 'watching', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id', _authRequired, async (req, res) => {
    try {
      const watch = store.getPostV2Watch(req.params.id);
      if (!watch) return res.json({ ok: true, status: 'empty', data: null });
      const safe = _sanitize(watch);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/post-v2/:id/cycle', _authRequired, async (req, res) => {
    try {
      const result = await watchMgr.runPostV2WatchCycle(req.params.id, services);
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/post-v2/:id/health-window', _authRequired, async (req, res) => {
    try {
      const existing = store.getPostV2Watch(req.params.id);
      if (!existing) return res.status(404).json({ ok: false, error: 'Watch not found' });
      if (existing.healthWindow) {
        const result = healthWindow.evaluatePostV2HealthWindow(req.params.id, services);
        const safe = _sanitize(result);
        return res.json({ ok: true, status: 'ready', data: safe });
      }
      const w = healthWindow.createPostV2HealthWindow(req.params.id, req.body || {}, services);
      const safe = _sanitize(w);
      res.json({ ok: true, status: 'open', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/regressions', _authRequired, async (req, res) => {
    try {
      const report = regressionWatchdog.buildRegressionWatchdogReport(req.params.id, services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/dashboard', _authRequired, async (req, res) => {
    try {
      const report = dashboardWatchdog.buildDashboardWatchdogReport(services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/apis', _authRequired, async (req, res) => {
    try {
      const report = apiWatchdog.buildApiWatchdogReport(services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/telegram', _authRequired, async (req, res) => {
    try {
      const report = telegramWatchdog.buildTelegramWatchdogReport(services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/pwa', _authRequired, async (req, res) => {
    try {
      const report = pwaWatchdog.buildPwaWatchdogReport(services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/performance', _authRequired, async (req, res) => {
    try {
      const report = perfWatchdog.buildPerformanceWatchdogReport(services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/security-privacy', _authRequired, async (req, res) => {
    try {
      const report = secWatchdog.buildSecurityPrivacyWatchdogReport(services);
      const safe = _sanitize(report);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/scorecard', _authRequired, async (req, res) => {
    try {
      const card = relScorecard.buildPostV2ReliabilityScorecard(req.params.id, services);
      const safe = _sanitize(card);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/post-v2/:id/rollback-proposal', _authRequired, async (req, res) => {
    try {
      const watch = store.getPostV2Watch(req.params.id);
      if (!watch) return res.status(404).json({ ok: false, error: 'Watch not found' });
      const recommendation = rollbackAdvisor.buildRollbackRecommendation(req.params.id, services);
      const safe = _sanitize(recommendation);
      res.json({ ok: true, status: 'proposal', data: safe, note: 'PROPOSAL ONLY — No direct rollback was executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/post-v2/:id/report', _authRequired, async (req, res) => {
    try {
      const report = await watchMgr.buildPostV2WatchReport(req.params.id, services);
      const regReport = regressionWatchdog.buildRegressionWatchdogReport(req.params.id, services);
      const dashReport = dashboardWatchdog.buildDashboardWatchdogReport(services);
      const apiReport = apiWatchdog.buildApiWatchdogReport(services);
      const telReport = telegramWatchdog.buildTelegramWatchdogReport(services);
      const pwaRep = pwaWatchdog.buildPwaWatchdogReport(services);
      const perfRep = perfWatchdog.buildPerformanceWatchdogReport(services);
      const secRep = secWatchdog.buildSecurityPrivacyWatchdogReport(services);
      const scorecard = relScorecard.buildPostV2ReliabilityScorecard(req.params.id, services);
      const rollback = rollbackAdvisor.buildRollbackAdvisorReport(req.params.id, services);
      const fullReport = _sanitize({
        watch: report,
        regressions: regReport,
        dashboard: dashReport,
        api: apiReport,
        telegram: telReport,
        pwa: pwaRep,
        performance: perfRep,
        securityPrivacy: secRep,
        scorecard,
        rollbackAdvisor: rollback,
        generatedAt: utils.now()
      });
      res.json({ ok: true, status: 'ready', data: fullReport });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerPostV2Routes };
