'use strict';

const classifier = require('./incident-classifier');
const rootCauseAnalyzer = require('./root-cause-analyzer');
const store = require('./incident-store');
const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

function classifyResponseActionRisk(action = {}) {
  const text = `${action.type || ''} ${action.title || ''} ${action.description || ''}`.toLowerCase();
  if (/rollback|restore|import|delete|env|config|deploy|external write|permission/.test(text)) return 'danger';
  if (/repair|workflow|github|integration/.test(text)) return 'high';
  if (/backup|benchmark|diagnostic/.test(text)) return 'medium';
  return 'low';
}

function suggestMitigationActions(incident = {}, services = {}) {
  const severity = classifier.classifyIncidentSeverity(incident);
  const systems = classifier.classifyAffectedSystems(incident);
  const actions = [{
    id: utils.createId('ira'),
    type: 'ops.diagnostics.run',
    title: 'Run read-only diagnostics',
    description: 'Collect sanitized health/diagnostic summary before any repair.',
    riskLevel: 'low',
    requiresApproval: true,
    expectedResult: 'Sanitized diagnostics report.',
    proposalOnly: true
  }];
  if (systems.includes('dashboard')) {
    actions.push({
      id: utils.createId('ira'),
      type: 'report.health.export',
      title: 'Export dashboard health report',
      description: 'Create sanitized dashboard health report for repair planning.',
      riskLevel: 'low',
      requiresApproval: true,
      expectedResult: 'Health report linked to incident.',
      proposalOnly: true
    });
  }
  if (systems.includes('storage')) {
    actions.push({
      id: utils.createId('ira'),
      type: 'backup.validate',
      title: 'Validate latest backup before mitigation',
      description: 'Validate backup manifest before risky storage mitigation.',
      riskLevel: 'medium',
      requiresApproval: true,
      expectedResult: 'Backup validation result.',
      proposalOnly: true
    });
  }
  if (['critical', 'high'].includes(severity) || systems.includes('deploy')) {
    actions.push({
      id: utils.createId('ira'),
      type: 'restore.run',
      title: 'Prepare rollback proposal only',
      description: 'Rollback must stay blocked until Evaluation v2 and human executor approval.',
      riskLevel: 'danger',
      requiresApproval: true,
      expectedResult: 'Rollback proposal, not direct rollback.',
      proposalOnly: true
    });
  }
  return actions.map(action => ({ ...action, riskLevel: classifyResponseActionRisk(action) === 'danger' ? 'danger' : action.riskLevel }));
}

function suggestRepairPlan(incident = {}, services = {}) {
  return {
    recommended: classifier.classifyAffectedSystems(incident).some(system => ['dashboard', 'executor', 'integrations'].includes(system)),
    summary: 'Repair harus dibuat sebagai prompt/proposal terpisah. Runtime bot tidak boleh memodifikasi kode atau push langsung.',
    steps: [
      'Run sanitized diagnostics.',
      'Run related regression tests.',
      'Create executor proposal for any write/external action.',
      'Wait for approval before run.'
    ]
  };
}

function suggestRollbackPlan(incident = {}, services = {}) {
  const severity = classifier.classifyIncidentSeverity(incident);
  return {
    recommended: ['critical', 'high'].includes(severity) && classifier.classifyAffectedSystems(incident).includes('deploy'),
    summary: 'Rollback hanya boleh berupa proposal. Tidak ada direct rollback dari runtime.',
    requiresEvaluation: true,
    requiresExecutorApproval: true
  };
}

function buildIncidentResponseSummary(plan = {}) {
  return [
    `Response plan: ${plan.id}`,
    `Incident: ${plan.incidentId}`,
    `Risk: ${plan.riskLevel}`,
    `Actions: ${(plan.actions || []).length}`,
    `Evaluation required: ${plan.requiresEvaluation ? 'yes' : 'no'}`,
    `Executor approval required: ${plan.requiresExecutorApproval ? 'yes' : 'no'}`
  ].join('\n');
}

async function createIncidentResponsePlan(incidentId, services = {}) {
  const incident = await store.getIncident(incidentId, services);
  if (!incident) return { ok: false, error: 'INCIDENT_NOT_FOUND' };
  const rootCause = await rootCauseAnalyzer.analyzeRootCause(incident, services);
  const actions = suggestMitigationActions(incident, services);
  const risks = actions.map(action => action.riskLevel);
  const plan = await store.upsertResponsePlan({
    incidentId,
    actions,
    riskLevel: utils.maxRisk(risks),
    requiresEvaluation: true,
    requiresExecutorApproval: true,
    rollbackRecommended: suggestRollbackPlan(incident, services).recommended,
    repairRecommended: suggestRepairPlan(incident, services).recommended,
    status: 'draft',
    rootCause
  }, services);
  await store.addIncidentEvent(incidentId, {
    source: 'incident-response-planner',
    type: 'response_plan_created',
    severity: incident.severity,
    summary: `Response plan ${plan.id} created.`
  }, services);
  return { ok: true, plan: sanitizer.sanitize(plan), rootCause };
}

module.exports = {
  buildIncidentResponseSummary,
  classifyResponseActionRisk,
  createIncidentResponsePlan,
  suggestMitigationActions,
  suggestRepairPlan,
  suggestRollbackPlan
};
