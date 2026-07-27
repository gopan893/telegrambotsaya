'use strict';

const store = require('./device-store');
const utils = require('./device-utils');
const registry = require('./device-registry');
const healthMonitor = require('./device-health-monitor');
const riskClassifier = require('./device-risk-classifier');
const capabilityRegistry = require('./device-capability-registry');
const audit = require('./device-audit');

function generateDeviceReport(deviceId) {
  const device = store.getDevice(deviceId);
  if (!device) return { ok: false, error: 'Device not found' };
  const health = healthMonitor.getHealthSummary(deviceId);
  const risk = riskClassifier.getDeviceRiskProfile(deviceId);
  const caps = capabilityRegistry.getCapabilities(deviceId);
  const validations = capabilityRegistry.validateCapabilities(deviceId);
  const events = audit.getDeviceEvents(deviceId);
  const proposals = store.listProposals({ deviceId });

  return {
    ok: true,
    report: {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        status: device.status,
        trustLevel: device.trustLevel,
        ownerOnly: device.ownerOnly,
        localOnly: device.localOnly,
        lastSeenAt: device.lastSeenAt
      },
      health,
      riskProfile: risk,
      capabilities: caps ? caps.capabilities : [],
      capabilityValidations: validations,
      recentEvents: events.slice(0, 20),
      pendingProposals: proposals.filter(p => p.status === 'pending').length,
      totalProposals: proposals.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateFleetReport() {
  const devices = store.listDevices();
  const registryStats = registry.getRegistryStats();
  const healthStats = healthMonitor.aggregateHealthStats();
  const riskProfiles = riskClassifier.listRiskProfiles();
  const validationResults = devices.map(d => ({
    deviceId: d.id,
    ...capabilityRegistry.validateCapabilities(d.id)
  }));
  const totalProposals = store.listProposals().length;
  const pendingProposals = store.listProposals({ status: 'pending' }).length;

  return {
    ok: true,
    report: {
      registry: registryStats,
      health: healthStats,
      riskProfiles: riskProfiles.map(r => ({ deviceId: r.deviceId, level: r.riskProfile ? r.riskProfile.level : 'unknown' })),
      capabilityIssues: validationResults.filter(v => !v.valid),
      proposals: { total: totalProposals, pending: pendingProposals },
      generatedAt: new Date().toISOString()
    }
  };
}

function generateSecurityReport() {
  const devices = store.listDevices();
  const blockedDevices = devices.filter(d => d.blockedActions && d.blockedActions.length > 0);
  const untrustedDevices = devices.filter(d => d.trustLevel === 'untrusted');
  const violations = [];
  for (const dev of devices) {
    const v = capabilityRegistry.validateCapabilities(dev.id);
    if (!v.valid) violations.push({ deviceId: dev.id, violations: v.violations });
  }
  return {
    ok: true,
    report: {
      totalDevices: devices.length,
      blockedActionDevices: blockedDevices.length,
      untrustedDevices: untrustedDevices.length,
      capabilityViolations: violations,
      generatedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  generateDeviceReport, generateFleetReport, generateSecurityReport
};
