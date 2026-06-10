'use strict';

const utils = require('../plugin-hardening/plugin-hardening-utils');
const store = require('../plugin-hardening/plugin-hardening-store');
const compatChecker = require('../plugin-hardening/plugin-compatibility-checker');
const permVersion = require('../plugin-hardening/plugin-permission-versioning');
const sandboxPolicy = require('../plugin-hardening/plugin-sandbox-policy');
const lifecycleMgr = require('../plugin-hardening/plugin-lifecycle-manager');
const healthMon = require('../plugin-hardening/plugin-health-monitor');
const riskSim = require('../plugin-hardening/plugin-risk-simulator');
const upgradePlan = require('../plugin-hardening/plugin-upgrade-planner');
const deprecationMgr = require('../plugin-hardening/plugin-deprecation-manager');
const docsGen = require('../plugin-hardening/plugin-docs-generator');
const certGate = require('../plugin-hardening/plugin-certification-gate');
const reportGen = require('../plugin-hardening/plugin-hardening-report-generator');
const connHarness = require('../connector-hardening/connector-test-harness');
const connValidator = require('../connector-hardening/connector-contract-validator');
const connAudit = require('../connector-hardening/connector-permission-auditor');
const connHealth = require('../connector-hardening/connector-health-monitor');
const connReport = require('../connector-hardening/connector-hardening-report-generator');

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

function registerPluginHardeningRoutes(app, services = {}) {
  app.get('/api/dashboard/plugin-hardening', _authRequired, async (req, res) => {
    try {
      const plugins = store.getAllPlugins ? store.getAllPlugins() : [];
      const latest = plugins.length > 0 ? plugins[plugins.length - 1] : null;
      const sanitized = latest ? _sanitize({
        id: latest.id,
        name: latest.name,
        version: latest.version,
        status: latest.status,
        compatibilityStatus: latest.compatibilityStatus,
        permissionStatus: latest.permissionStatus,
        sandboxStatus: latest.sandboxStatus,
        lifecycleStatus: latest.lifecycleStatus,
        healthStatus: latest.healthStatus,
        certificationStatus: latest.certificationStatus,
        connectorStatus: latest.connectorStatus,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt
      }) : null;
      res.json({ ok: true, status: latest ? latest.status : 'empty', data: sanitized });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/plugin-hardening/compatibility', _authRequired, async (req, res) => {
    try {
      const result = compatChecker.checkAllPluginCompatibility ? compatChecker.checkAllPluginCompatibility(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/plugin-hardening/permissions', _authRequired, async (req, res) => {
    try {
      const result = permVersion.getVersionedPermissions ? permVersion.getVersionedPermissions(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/plugin-hardening/sandbox', _authRequired, async (req, res) => {
    try {
      const result = sandboxPolicy.getSandboxPolicies ? sandboxPolicy.getSandboxPolicies(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/plugin-hardening/lifecycle', _authRequired, async (req, res) => {
    try {
      const result = lifecycleMgr.getLifecycleStatus ? lifecycleMgr.getLifecycleStatus(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/plugin-hardening/health', _authRequired, async (req, res) => {
    try {
      const result = healthMon.getPluginHealth ? healthMon.getPluginHealth(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/plugin-hardening/simulate', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = riskSim.simulateRisk ? riskSim.simulateRisk(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Simulation only. No real actions executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/plugin-hardening/certify', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = certGate.evaluateCertification ? certGate.evaluateCertification(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Certification check only. No real certification granted.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/plugin-hardening/upgrade-plan', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = upgradePlan.buildUpgradePlan ? upgradePlan.buildUpgradePlan(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'PROPOSAL ONLY — No upgrade executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/plugin-hardening/deprecation-plan', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = deprecationMgr.buildDeprecationPlan ? deprecationMgr.buildDeprecationPlan(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'PROPOSAL ONLY — No deprecation executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/plugin-hardening/connector-test', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const harnessResult = connHarness.runConnectorTests ? connHarness.runConnectorTests(input, services) : {};
      const contractResult = connValidator.validateConnectorContracts ? connValidator.validateConnectorContracts(input, services) : {};
      const auditResult = connAudit.auditConnectorPermissions ? connAudit.auditConnectorPermissions(input, services) : {};
      const safe = _sanitize({ harness: harnessResult, contract: contractResult, audit: auditResult });
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/plugin-hardening/report', _authRequired, async (req, res) => {
    try {
      const compatReport = compatChecker.checkAllPluginCompatibility ? compatChecker.checkAllPluginCompatibility(services) : {};
      const permReport = permVersion.getVersionedPermissions ? permVersion.getVersionedPermissions(services) : {};
      const sandboxReport = sandboxPolicy.getSandboxPolicies ? sandboxPolicy.getSandboxPolicies(services) : {};
      const lifecycleReport = lifecycleMgr.getLifecycleStatus ? lifecycleMgr.getLifecycleStatus(services) : {};
      const healthReport = healthMon.getPluginHealth ? healthMon.getPluginHealth(services) : {};
      const connHealthReport = connHealth.getConnectorHealth ? connHealth.getConnectorHealth(services) : {};
      const fullReport = reportGen.generateHardeningReport ? reportGen.generateHardeningReport({
        compatibility: compatReport,
        permissions: permReport,
        sandbox: sandboxReport,
        lifecycle: lifecycleReport,
        health: healthReport,
        connectorHealth: connHealthReport
      }, services) : {};
      const safe = _sanitize(fullReport);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerPluginHardeningRoutes };
