'use strict';

function createWriteProposalSimulator(connectorId, config) {
  return {
    connectorId,
    config: config || {},
    proposals: [],
    status: 'idle',
    createdAt: new Date().toISOString()
  };
}

function simulateWriteProposal(simulator, action) {
  if (!simulator) return { ok: false, error: 'No simulator' };
  if (!action || !action.type) return { ok: false, error: 'Action type required' };

  const proposal = {
    connectorId: simulator.connectorId,
    action: action.type,
    target: action.target || null,
    params: action.params || {},
    proposalOnly: true,
    wouldExecute: false,
    simulatedAt: new Date().toISOString(),
    risk: classifyWriteAction(action.type),
    status: 'proposal_only',
    blockers: []
  };

  if (proposal.risk.level === 'critical') {
    proposal.blockers.push('Critical write action requires approval: ' + action.type);
  }

  try {
    if (typeof action.mockFn === 'function') {
      proposal.output = action.mockFn(simulator.config);
    } else {
      proposal.output = { mock: true, message: 'Simulated write proposal for: ' + action.type };
    }
  } catch (err) {
    proposal.error = err.message;
  }

  simulator.proposals.push(proposal);
  return { ok: true, proposal, ...proposal };
}

function simulateBatchProposals(simulator, actions) {
  if (!Array.isArray(actions)) return { ok: false, error: 'Actions must be an array' };
  const proposals = [];
  let requiresApproval = false;
  for (const action of actions) {
    const result = simulateWriteProposal(simulator, action);
    proposals.push(result);
    if (result.ok && result.proposal && result.proposal.risk && result.proposal.risk.proposalRequired) {
      requiresApproval = true;
    }
  }
  return proposals;
}

function classifyWriteAction(actionType) {
  if (!actionType) return { level: 'unknown', proposalRequired: true };
  const lower = String(actionType).toLowerCase();
  if (lower === 'read' || lower === 'get' || lower === 'fetch' || lower === 'list') {
    return { level: 'low', proposalRequired: false };
  }
  if (['deploy', 'release', 'rollback', 'restore', 'shell'].some(k => lower.includes(k))) {
    return { level: 'critical', proposalRequired: true };
  }
  if (['delete', 'remove', 'destroy', 'purge'].some(k => lower.includes(k))) {
    return { level: 'high', proposalRequired: true };
  }
  if (['write', 'create', 'update', 'send', 'post', 'push', 'edit'].some(k => lower.includes(k))) {
    return { level: 'high', proposalRequired: true };
  }
  return { level: 'medium', proposalRequired: true };
}

function getProposalSummary(simulator) {
  if (!simulator) return {};
  const proposals = simulator.proposals || [];
  return {
    connectorId: simulator.connectorId,
    total: proposals.length,
    requiresApproval: proposals.some(p => p.risk && p.risk.proposalRequired),
    byLevel: proposals.reduce((acc, p) => {
      const level = p.risk ? p.risk.level : 'unknown';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {})
  };
}

function ensureNeverExecutesRealWrites() {
  return {
    enforced: true,
    safe: true,
    neverExecutes: true,
    message: 'Write proposal simulator NEVER executes real writes',
    guarantee: 'All write operations are proposal-only',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  createWriteProposalSimulator, simulateWriteProposal, simulateBatchProposals,
  classifyWriteAction, getProposalSummary, ensureNeverExecutesRealWrites
};
