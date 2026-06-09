'use strict';

const express = require('express');
const guards = require('./dashboard-guards');
const reliability = require('../reliability');

function sanitize(obj) {
  if (!obj) return null;
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (/(token|secret|key|password|auth|credential)/i.test(lk) && typeof v === 'string' && v.length > 4) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = v;
    }
  }
  return result;
}

function registerReliabilityRoutes(router, services = {}) {
  reliability.SloRegistry.initializeDefaultSlos();

  router.get('/reliability', (req, res) => {
    const scorecard = reliability.ReliabilityScorecard.calculateReliabilityScorecard(services);
    const sloStatus = reliability.SloMonitor.evaluateSloStatus(services);
    const regWatch = reliability.RegressionWatchdog;
    const regs = regWatch.getStore().regressions || [];
    return guards.safeDashboardResponse(res, {
      ok: true,
      scorecard: sanitize(scorecard),
      sloStatus: sanitize(sloStatus),
      regressions: regs.map(sanitize)
    });
  });

  router.get('/reliability/slos', (req, res) => {
    const slos = reliability.SloRegistry.listSlos({ enabled: true });
    return guards.safeDashboardResponse(res, { ok: true, slos: slos.map(sanitize), count: slos.length });
  });

  router.post('/reliability/slos/evaluate', (req, res) => {
    const status = reliability.SloMonitor.evaluateSloStatus(services);
    return guards.safeDashboardResponse(res, { ok: true, ...sanitize(status) });
  });

  router.get('/reliability/scorecard', (req, res) => {
    const scorecard = reliability.ReliabilityScorecard.calculateReliabilityScorecard(services);
    return guards.safeDashboardResponse(res, { ok: true, scorecard: sanitize(scorecard) });
  });

  router.post('/reliability/post-release/:releaseId/start', (req, res) => {
    const duration = parseInt(req.body.durationMinutes) || 30;
    const hw = reliability.ReleaseHealthWindow.openReleaseHealthWindow(req.params.releaseId, duration, services);
    const monitor = reliability.PostReleaseMonitor.startPostReleaseMonitoring(req.params.releaseId, services);
    return guards.safeDashboardResponse(res, { ok: true, healthWindow: sanitize(hw), monitoring: sanitize(monitor) });
  });

  router.post('/reliability/post-release/:releaseId/check', (req, res) => {
    const sample = {
      uptime: req.body.uptime,
      latency: req.body.latency,
      telegramCommandSuccess: req.body.telegramCommandSuccess,
      dashboardApiSuccess: req.body.dashboardApiSuccess,
      errors: req.body.errors,
      incidents: req.body.incidents
    };
    const hwResult = reliability.ReleaseHealthWindow.recordHealthSample(req.params.releaseId, sample, services);
    const monitorResult = reliability.PostReleaseMonitor.runPostReleaseHealthCheck(req.params.releaseId, services);
    return guards.safeDashboardResponse(res, {
      ok: hwResult.ok && monitorResult.ok,
      healthSample: sanitize(hwResult.sample || hwResult),
      monitoringSample: sanitize(monitorResult.sample || monitorResult)
    });
  });

  router.get('/reliability/post-release/:releaseId/report', (req, res) => {
    const monitorReport = reliability.PostReleaseMonitor.buildPostReleaseMonitoringReport(req.params.releaseId, services);
    const hwSummary = reliability.ReleaseHealthWindow.summarizeHealthWindow(req.params.releaseId, services);
    const regCheck = reliability.RegressionWatchdog;
    const dashboardReg = regCheck.watchDashboardRegression(services);
    const telegramReg = regCheck.watchTelegramRegression(services);
    const approvalReg = regCheck.watchApprovalBoundaryRegression(services);
    const securityReg = regCheck.watchSecurityPrivacyRegression(services);
    const deployReg = regCheck.watchDeployRegression(services);
    const scorecard = reliability.ReliabilityScorecard.calculateReliabilityScorecard(services);
    const sloStatus = reliability.SloMonitor.evaluateSloStatus(services);
    const report = reliability.ReliabilityReportGenerator.generateReliabilityReport(sloStatus, scorecard, [hwSummary], [], services);
    return guards.safeDashboardResponse(res, {
      ok: true,
      monitoring: sanitize(monitorReport),
      healthWindow: sanitize(hwSummary),
      regressions: {
        dashboard: sanitize(dashboardReg),
        telegram: sanitize(telegramReg),
        approval: sanitize(approvalReg),
        securityPrivacy: sanitize(securityReg),
        deploy: sanitize(deployReg)
      },
      report: sanitize(report)
    });
  });

  router.get('/reliability/regressions', (req, res) => {
    const watchdog = reliability.RegressionWatchdog;
    const dashboard = watchdog.watchDashboardRegression(services);
    const telegram = watchdog.watchTelegramRegression(services);
    const approval = watchdog.watchApprovalBoundaryRegression(services);
    const security = watchdog.watchSecurityPrivacyRegression(services);
    const deploy = watchdog.watchDeployRegression(services);
    return guards.safeDashboardResponse(res, {
      ok: true,
      checks: {
        dashboard: sanitize(dashboard),
        telegram: sanitize(telegram),
        approval: sanitize(approval),
        securityPrivacy: sanitize(security),
        deploy: sanitize(deploy)
      }
    });
  });
}

module.exports = { registerReliabilityRoutes };
