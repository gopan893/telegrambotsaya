'use strict';

const store = require('./local-node-store');
const registry = require('./local-node-registry');
const healthChecker = require('./local-node-health-checker');
const heartbeat = require('./local-node-heartbeat');
const capabilityMapper = require('./local-node-capability-mapper');
const safetyBoundary = require('./local-node-safety-boundary');

function generateNodeReport(nodeId) {
  const node = store.getNode(nodeId);
  if (!node) return { ok: false, error: 'Node not found' };
  const health = healthChecker.getHealthSummary(nodeId);
  const hb = heartbeat.getHeartbeat(nodeId);
  const caps = capabilityMapper.getCapabilities(nodeId);
  const validations = capabilityMapper.validateCapabilities(nodeId);
  const boundary = safetyBoundary.getSafetyBoundary(nodeId);

  return {
    ok: true,
    report: {
      node: { id: node.id, name: node.name, type: node.type, status: node.status },
      health,
      heartbeat: hb,
      capabilities: caps ? caps.capabilities : [],
      capabilityValidations: validations,
      safetyBoundary: boundary ? { enforced: boundary.enforced, blockedCategories: boundary.blockedCategories } : null,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateFleetReport() {
  const nodes = store.listNodes();
  const registryStats = registry.getRegistryStats();
  const healthStats = healthChecker.aggregateHealthStats();
  const heartbeatStats = heartbeat.getHeartbeatStats();
  const capsList = capabilityMapper.listNodeCapabilities();
  const issues = capsList.filter(c => c.capabilities.some(cap => cap.blocked || cap.safety === 'unknown'));

  return {
    ok: true,
    report: {
      registry: registryStats,
      health: healthStats,
      heartbeat: heartbeatStats,
      capabilityIssues: issues,
      totalNodes: nodes.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateSafetyReport() {
  const nodes = store.listNodes();
  const boundaries = nodes.map(n => ({
    nodeId: n.id,
    nodeName: n.name,
    boundary: safetyBoundary.getSafetyBoundary(n.id)
  }));
  const enforcedCount = boundaries.filter(b => b.boundary && b.boundary.enforced).length;
  const missingBoundary = boundaries.filter(b => !b.boundary);

  return {
    ok: true,
    report: {
      totalNodes: nodes.length,
      enforcedBoundaries: enforcedCount,
      missingBoundaries: missingBoundary.map(b => ({ nodeId: b.nodeId, nodeName: b.nodeName })),
      generatedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  generateNodeReport, generateFleetReport, generateSafetyReport
};
