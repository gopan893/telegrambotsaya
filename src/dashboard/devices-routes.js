'use strict';

const deviceRegistry = require('../devices/device-registry');
const manifestValidator = require('../devices/device-manifest-validator');
const pairingManager = require('../devices/device-pairing-manager');
const healthMonitor = require('../devices/device-health-monitor');
const capabilityRegistry = require('../devices/device-capability-registry');
const riskClassifier = require('../devices/device-risk-classifier');
const actionPlanner = require('../devices/device-action-planner');
const actionSimulator = require('../devices/device-action-simulator');
const proposalBridge = require('../devices/device-proposal-bridge');
const nodeRegistry = require('../local-nodes/local-node-registry');
const nodeHandshake = require('../local-nodes/local-node-handshake');
const nodeHeartbeat = require('../local-nodes/local-node-heartbeat');
const nodeHealthChecker = require('../local-nodes/local-node-health-checker');
const localAiMonitor = require('../local-integrations/local-ai-node-monitor');
const nasMonitor = require('../local-integrations/nas-node-monitor');
const tunnelMonitor = require('../local-integrations/tunnel-status-monitor');
const fileSyncChecker = require('../local-integrations/file-sync-status-checker');

function _sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = { ...obj };
  delete clean.token;
  delete clean.secret;
  delete clean.password;
  delete clean.apiKey;
  return clean;
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

function registerDevicesRoutes(app, services = {}) {
  app.get('/api/dashboard/devices', _authRequired, async (req, res) => {
    try {
      const devices = deviceRegistry.listDevices();
      const stats = deviceRegistry.getRegistryStats();
      const healthStats = healthMonitor.aggregateHealthStats();
      const nodeCount = nodeRegistry.getNodeCount();
      const aiStatus = localAiMonitor.getAiNodeStatus();
      const nasStatus = nasMonitor.getNasStatus();
      const tunnelStatus = tunnelMonitor.getTunnelStatus();
      const syncStatus = fileSyncChecker.getFileSyncSummary();
      res.json({ ok: true, status: 'ready', data: _sanitize({ stats, healthStats, nodeCount, aiStatus, nasStatus, tunnelStatus, syncStatus, deviceCount: devices.length }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/list', _authRequired, async (req, res) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.type) filter.type = req.query.type;
      const devices = deviceRegistry.listDevices(filter);
      res.json({ ok: true, status: 'ready', data: devices.map(_sanitize) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/register', _authRequired, async (req, res) => {
    try {
      const result = deviceRegistry.registerDevice(req.body || {});
      res.json({ ok: true, status: result.ok ? 'registered' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/:id', _authRequired, async (req, res) => {
    try {
      const device = deviceRegistry.getDevice(req.params.id);
      if (!device) return res.status(404).json({ ok: false, error: 'Device not found' });
      res.json({ ok: true, status: 'ready', data: _sanitize(device) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/:id/health', _authRequired, async (req, res) => {
    try {
      const health = healthMonitor.getHealthSummary(req.params.id);
      res.json({ ok: true, status: 'ready', data: _sanitize(health) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/:id/capabilities', _authRequired, async (req, res) => {
    try {
      const caps = capabilityRegistry.getDeviceCapabilities(req.params.id);
      res.json({ ok: true, status: 'ready', data: caps });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/:id/simulate-action', _authRequired, async (req, res) => {
    try {
      const result = actionSimulator.simulateAction({ deviceId: req.params.id, ...(req.body || {}) });
      res.json({ ok: true, status: 'simulated', data: _sanitize(result), note: 'READ-ONLY — Simulation only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/:id/proposal', _authRequired, async (req, res) => {
    try {
      const proposals = proposalBridge.listProposals({ deviceId: req.params.id });
      res.json({ ok: true, status: 'ready', data: proposals.map(_sanitize) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/pairing/request', _authRequired, async (req, res) => {
    try {
      const result = pairingManager.createPairingRequest(req.body || {});
      res.json({ ok: true, status: result.ok ? 'requested' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/pairing/:id/approve', _authRequired, async (req, res) => {
    try {
      const result = pairingManager.approvePairing(req.params.id, req.body?.approvedBy);
      res.json({ ok: true, status: result.ok ? 'approved' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/pairing/:id/reject', _authRequired, async (req, res) => {
    try {
      const result = pairingManager.rejectPairing(req.params.id, req.body?.rejectedBy, req.body?.reason);
      res.json({ ok: true, status: result.ok ? 'rejected' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/local-nodes', _authRequired, async (req, res) => {
    try {
      const nodes = nodeRegistry.listNodes();
      const healthStats = nodeHealthChecker.aggregateNodeHealth();
      res.json({ ok: true, status: 'ready', data: _sanitize({ nodes, healthStats }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/local-nodes/handshake', _authRequired, async (req, res) => {
    try {
      const result = nodeHandshake.completeHandshake(req.body || {});
      res.json({ ok: true, status: result.ok ? 'handshake_sent' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/devices/local-nodes/heartbeat', _authRequired, async (req, res) => {
    try {
      const result = nodeHeartbeat.recordHeartbeat(req.body?.nodeId, req.body || {});
      res.json({ ok: true, status: result.ok ? 'recorded' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/local-ai', _authRequired, async (req, res) => {
    try {
      const status = localAiMonitor.getAiNodeStatus();
      const nodes = localAiMonitor.listAiNodes();
      res.json({ ok: true, status: 'ready', data: _sanitize({ status, nodes }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/nas', _authRequired, async (req, res) => {
    try {
      const status = nasMonitor.getNasStatus();
      const nodes = nasMonitor.listNasNodes();
      res.json({ ok: true, status: 'ready', data: _sanitize({ status, nodes }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/tunnels', _authRequired, async (req, res) => {
    try {
      const status = tunnelMonitor.getTunnelStatus();
      const tunnels = tunnelMonitor.listTunnels();
      res.json({ ok: true, status: 'ready', data: _sanitize({ status, tunnels }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/devices/report', _authRequired, async (req, res) => {
    try {
      const devices = deviceRegistry.listDevices();
      const stats = deviceRegistry.getRegistryStats();
      const healthStats = healthMonitor.aggregateHealthStats();
      const nodeHealth = nodeHealthChecker.aggregateNodeHealth();
      const aiStatus = localAiMonitor.getAiNodeStatus();
      const nasStatus = nasMonitor.getNasStatus();
      const tunnelStatus = tunnelMonitor.getTunnelStatus();
      const syncStatus = fileSyncChecker.getFileSyncSummary();
      res.json({ ok: true, status: 'ready', data: _sanitize({ stats, healthStats, nodeHealth, aiStatus, nasStatus, tunnelStatus, syncStatus, deviceCount: devices.length }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerDevicesRoutes };
