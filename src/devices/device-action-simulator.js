'use strict';

const store = require('./device-store');
const utils = require('./device-utils');
const riskClassifier = require('./device-risk-classifier');

function simulateAction(params) {
  if (!params || !params.deviceId || !params.action) {
    return { ok: false, error: 'Missing deviceId or action' };
  }
  const device = store.getDevice(params.deviceId);
  if (!device) return { ok: false, error: 'Device not found' };
  const risk = riskClassifier.classifyActionRisk(params.action);
  const sim = {
    id: utils.createId('sim'),
    deviceId: params.deviceId,
    action: params.action,
    params: params.params || {},
    riskLevel: risk.level,
    proposalRequired: risk.proposalRequired,
    simulatedAt: new Date().toISOString(),
    result: {
      wouldSucceed: device.status !== 'unreachable',
      estimatedLatencyMs: Math.floor(Math.random() * 500) + 50,
      sideEffects: risk.proposalRequired ? ['proposal_required'] : ['none'],
      blocked: riskClassifier.isActionBlocked(params.action, device.blockedActions || []),
      safe: riskClassifier.isActionSafe(params.action, device.safeActions || [])
    }
  };
  store.setSimulation(sim.id, sim);
  return { ok: true, simulation: sim };
}

function getSimulation(simId) {
  return store.getSimulation(simId);
}

function simulateDryRun(params) {
  const result = simulateAction(params);
  if (!result.ok) return result;
  return { ok: true, dryRun: true, simulation: result.simulation, note: 'READ-ONLY — No real action executed.' };
}

module.exports = { simulateAction, getSimulation, simulateDryRun };
