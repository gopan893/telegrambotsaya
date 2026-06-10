'use strict';

const RISK_LEVELS = ['read', 'report', 'internal_write', 'external_read', 'external_write', 'destructive', 'credential_access', 'shell', 'deploy', 'release', 'rollback', 'restore'];

const RISK_CLASSIFICATION = {
  read: { level: 'low', proposalRequired: false },
  report: { level: 'low', proposalRequired: false },
  internal_write: { level: 'low', proposalRequired: false },
  external_read: { level: 'medium', proposalRequired: false },
  external_write: { level: 'high', proposalRequired: true },
  destructive: { level: 'critical', proposalRequired: true },
  credential_access: { level: 'critical', proposalRequired: true },
  shell: { level: 'critical', proposalRequired: true },
  deploy: { level: 'critical', proposalRequired: true },
  release: { level: 'critical', proposalRequired: true },
  rollback: { level: 'critical', proposalRequired: true },
  restore: { level: 'critical', proposalRequired: true }
};

function classifyAction(actionType) {
  if (!actionType) return { level: 'unknown', proposalRequired: true, riskType: 'unknown' };
  const normalized = String(actionType).toLowerCase().replace(/[-\s]/g, '_');
  const classification = RISK_CLASSIFICATION[normalized];
  if (classification) {
    return { ...classification, riskType: normalized };
  }
  return { level: 'medium', proposalRequired: true, riskType: 'unknown' };
}

function simulatePluginAction(pluginId, action, context) {
  if (!pluginId || !action) return { ok: false, error: 'Missing pluginId or action' };
  const riskType = classifyAction(action.type);
  const simulation = {
    pluginId,
    action: { type: action.type, target: action.target, params: action.params || {} },
    risk: riskType,
    proposalRequired: riskType.proposalRequired,
    simulatedAt: new Date().toISOString(),
    wouldExecute: false,
    proposal: null,
    blockers: []
  };

  if (riskType.level === 'critical') {
    simulation.blockers.push('Critical risk action requires approval: ' + riskType.riskType);
    simulation.proposal = {
      type: 'action_proposal',
      pluginId,
      action: action.type,
      risk: riskType,
      reason: 'Critical action simulated via risk simulator',
      status: 'pending'
    };
  } else if (riskType.proposalRequired) {
    simulation.proposal = {
      type: 'action_proposal',
      pluginId,
      action: action.type,
      risk: riskType,
      reason: 'High risk action simulated via risk simulator',
      status: 'pending'
    };
    simulation.blockers.push('Action requires proposal: ' + riskType.riskType);
  } else {
    simulation.wouldExecute = true;
  }

  return { ok: true, simulation };
}

function batchSimulate(pluginId, actions, context) {
  if (!Array.isArray(actions)) return { ok: false, error: 'Actions must be an array' };
  const results = [];
  let requiresApproval = false;
  for (const action of actions) {
    const result = simulatePluginAction(pluginId, action, context);
    results.push(result);
    if (result.ok && result.simulation && result.simulation.proposalRequired) {
      requiresApproval = true;
    }
  }
  return {
    ok: true,
    results,
    requiresApproval,
    totalActions: actions.length,
    blockedCount: results.filter(r => r.ok && r.simulation && r.simulation.blockers.length > 0).length
  };
}

function getRiskSummary(simulations) {
  if (!Array.isArray(simulations)) return {};
  const summary = { total: simulations.length, byLevel: {}, proposalsRequired: 0, blocked: 0 };
  for (const s of simulations) {
    const risk = s.risk || classifyAction(s.type);
    summary.byLevel[risk.level] = (summary.byLevel[risk.level] || 0) + 1;
    if (risk.proposalRequired) summary.proposalsRequired++;
    if (s.blockers && s.blockers.length > 0) summary.blocked++;
  }
  return summary;
}

function calculatePluginRiskScore(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return { score: 0, level: 'low' };
  let score = 0;
  for (const action of actions) {
    const risk = classifyAction(action.type || action);
    switch (risk.level) {
      case 'low': score += 1; break;
      case 'medium': score += 3; break;
      case 'high': score += 7; break;
      case 'critical': score += 15; break;
      default: score += 2;
    }
  }
  const normalized = Math.min(100, Math.round((score / actions.length) * 10));
  return {
    score: normalized,
    level: normalized >= 70 ? 'critical' : normalized >= 40 ? 'high' : normalized >= 20 ? 'medium' : 'low',
    totalRisk: score,
    actionCount: actions.length
  };
}

module.exports = {
  classifyAction, simulatePluginAction, batchSimulate,
  getRiskSummary, calculatePluginRiskScore,
  RISK_LEVELS, RISK_CLASSIFICATION
};
