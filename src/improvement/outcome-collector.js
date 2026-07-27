const { generateId, sanitizeImprovementText, now } = require('./improvement-utils');

const OUTCOME_TYPES = [
  'github_action',
  'dashboard_regression',
  'render_deploy',
  'executor_proposal',
  'incident_response',
  'operating_loop',
  'evaluation_suite',
  'telegram_command',
  'lifeos_plan',
  'portfolio_plan',
  'coding_workspace_plan',
];

function buildOutcome(base) {
  const nowISO = now();
  return {
    id: base.id || generateId(),
    workspaceId: base.workspaceId || null,
    source: base.source || 'system',
    sourceId: base.sourceId || null,
    outcomeType: base.outcomeType || 'operating_loop',
    status: base.status || 'success',
    summary: base.summary || '',
    safeDetails: base.safeDetails ? sanitizeImprovementText(base.safeDetails) : '',
    linkedFeedbackIds: base.linkedFeedbackIds || [],
    createdAt: base.createdAt || nowISO,
  };
}

function collectWorkflowOutcome(outcome, services) {
  const entry = buildOutcome({
    ...outcome,
    outcomeType: outcome.outcomeType || guessOutcomeType(outcome),
    source: 'github_action',
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('outcomes', entry);
}

function collectTestOutcome(testResult, services) {
  const entry = buildOutcome({
    workspaceId: testResult && testResult.workspaceId,
    sourceId: testResult && testResult.testId,
    outcomeType: 'evaluation_suite',
    source: 'system',
    status: (testResult && testResult.passed) ? 'success' : 'failed',
    summary: testResult && testResult.summary,
    safeDetails: testResult && JSON.stringify(testResult),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('outcomes', entry);
}

function collectDeployOutcome(deployResult, services) {
  const entry = buildOutcome({
    workspaceId: deployResult && deployResult.workspaceId,
    sourceId: deployResult && deployResult.deployId,
    outcomeType: 'render_deploy',
    source: 'system',
    status: deployResult && deployResult.success ? 'success' : 'failed',
    summary: deployResult && deployResult.summary,
    safeDetails: deployResult && JSON.stringify(deployResult),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('outcomes', entry);
}

function collectProposalOutcome(proposalResult, services) {
  const statusMap = { rejected: 'failed', approved: 'success', executed: 'success' };
  const status = statusMap[proposalResult && proposalResult.state] || 'skipped';
  const entry = buildOutcome({
    workspaceId: proposalResult && proposalResult.workspaceId,
    sourceId: proposalResult && proposalResult.proposalId,
    outcomeType: 'executor_proposal',
    source: 'system',
    status,
    summary: proposalResult && proposalResult.summary,
    safeDetails: proposalResult && JSON.stringify(proposalResult),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('outcomes', entry);
}

function collectIncidentOutcome(incidentResult, services) {
  const entry = buildOutcome({
    workspaceId: incidentResult && incidentResult.workspaceId,
    sourceId: incidentResult && incidentResult.incidentId,
    outcomeType: 'incident_response',
    source: 'system',
    status: incidentResult && incidentResult.resolved ? 'success' : 'failed',
    summary: incidentResult && incidentResult.summary,
    safeDetails: incidentResult && JSON.stringify(incidentResult),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('outcomes', entry);
}

function collectOperatingLoopOutcome(loopResult, services) {
  const entry = buildOutcome({
    workspaceId: loopResult && loopResult.workspaceId,
    sourceId: loopResult && loopResult.loopId,
    outcomeType: 'operating_loop',
    source: 'system',
    status: loopResult && loopResult.success ? 'success' : 'failed',
    summary: loopResult && loopResult.summary,
    safeDetails: loopResult && JSON.stringify(loopResult),
  });
  const store = services && services.store ? services.store : require('./improvement-store').getDefaultStore();
  return store.add('outcomes', entry);
}

function guessOutcomeType(raw) {
  if (!raw) return 'operating_loop';
  const src = (raw.source || '').toLowerCase();
  if (src.includes('github') || src.includes('action')) return 'github_action';
  if (src.includes('deploy')) return 'render_deploy';
  if (src.includes('proposal')) return 'executor_proposal';
  if (src.includes('incident')) return 'incident_response';
  if (src.includes('dashboard') || src.includes('regression')) return 'dashboard_regression';
  if (src.includes('telegram')) return 'telegram_command';
  if (src.includes('lifeos')) return 'lifeos_plan';
  if (src.includes('portfolio')) return 'portfolio_plan';
  if (src.includes('coding') || src.includes('workspace')) return 'coding_workspace_plan';
  return 'operating_loop';
}

function getOutcomes(filters) {
  const store = require('./improvement-store').getDefaultStore();
  let results = store.getAll('outcomes');
  if (!filters) return results;
  if (filters.type) {
    results = results.filter(o => o.outcomeType === filters.type);
  }
  if (filters.status) {
    results = results.filter(o => o.status === filters.status);
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    results = results.filter(o => new Date(o.createdAt).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    results = results.filter(o => new Date(o.createdAt).getTime() <= end);
  }
  return results;
}

module.exports = {
  OUTCOME_TYPES,
  collectWorkflowOutcome,
  collectTestOutcome,
  collectDeployOutcome,
  collectProposalOutcome,
  collectIncidentOutcome,
  collectOperatingLoopOutcome,
  getOutcomes,
};
