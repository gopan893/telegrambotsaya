'use strict';

const store = require('./knowledge-graph-store');
const nodeManager = require('./knowledge-node-manager');
const safetyGate = require('./memory-safety-gate');
const dedup = require('./memory-deduplicator');
const decisionMemory = require('./decision-memory-manager');
const utils = require('./knowledge-utils');

function safeIngest(type, input, services = {}) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'INVALID_INPUT' };
  const candidate = {
    type,
    title: utils.safeStr(input.title || '', 200),
    summary: utils.safeStr(input.summary || '', 1000),
    tags: utils.safeArray(input.tags).map(t => String(t)).slice(0, 20),
    source: utils.safeStr(input.source || `ingestor.${type}`, 80),
    sourceId: utils.safeStr(input.sourceId || `${type}-${Date.now()}`, 120),
    sensitivity: utils.isValidSensitivity(input.sensitivity) ? input.sensitivity : 'internal',
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0.7,
    metadata: utils.redactObject(input.metadata || {})
  };
  const gate = safetyGate.runMemorySafetyGate(candidate, services);
  if (!gate.ok) {
    return { ok: false, error: gate.reason, safeSummary: gate.safeSummary, report: gate.report };
  }
  const dedupe = dedup.buildDeduplicationReport(candidate, services);
  if (dedupe.isDuplicate && dedupe.exactMatch) {
    return { ok: true, deduplicated: true, existing: dedupe.exactMatch, report: dedupe };
  }
  const created = store.createKnowledgeNode(candidate, services);
  if (!created.ok) return { ok: false, error: created.error };
  if (input.linkedProjectId) linkToProject(created.node.id, input.linkedProjectId, services);
  if (input.linkedPhaseId) linkToPhase(created.node.id, input.linkedPhaseId, services);
  if (Array.isArray(input.relatedNodeIds)) {
    for (const rel of input.relatedNodeIds) {
      if (rel?.id) {
        store.createKnowledgeEdge({
          fromNodeId: created.node.id,
          toNodeId: rel.id,
          relation: utils.isValidRelation(rel.relation) ? rel.relation : 'relates_to',
          source: 'ingestor'
        }, services);
      }
    }
  }
  return { ok: true, node: created.node, report: dedupe };
}

function linkToProject(nodeId, projectId, services = {}) {
  if (!projectId) return null;
  return store.createKnowledgeEdge({
    fromNodeId: nodeId,
    toNodeId: projectId,
    relation: 'relates_to',
    source: 'ingestor',
    evidence: 'project link'
  }, services);
}

function linkToPhase(nodeId, phaseId, services = {}) {
  if (!phaseId) return null;
  return store.createKnowledgeEdge({
    fromNodeId: nodeId,
    toNodeId: phaseId,
    relation: 'documented_in',
    source: 'ingestor',
    evidence: 'phase link'
  }, services);
}

function ingestProjectGoal(goal, services = {}) {
  if (!goal) return { ok: false, error: 'NO_GOAL' };
  return safeIngest('project', {
    title: goal.title || 'Project Goal',
    summary: goal.summary || goal.description || '',
    tags: ['goal', ...(goal.tags || [])],
    source: 'project_goal',
    sourceId: goal.id,
    sensitivity: 'internal',
    confidence: 0.9,
    linkedProjectId: goal.linkedProjectId,
    metadata: { category: goal.category, priority: goal.priority }
  }, services);
}

function ingestOperatorPlan(plan, services = {}) {
  if (!plan) return { ok: false, error: 'NO_PLAN' };
  return safeIngest('phase', {
    title: plan.title || `Operator Plan ${plan.id || ''}`,
    summary: plan.summary || '',
    tags: ['plan', 'operator'],
    source: 'operator_plan',
    sourceId: plan.id,
    sensitivity: 'internal',
    confidence: 0.85,
    linkedProjectId: plan.linkedProjectId,
    linkedPhaseId: plan.id,
    metadata: { phases: plan.phases, risks: plan.risks }
  }, services);
}

function ingestPortfolioSnapshot(snapshot, services = {}) {
  if (!snapshot) return { ok: false, error: 'NO_SNAPSHOT' };
  return safeIngest('memory', {
    title: snapshot.title || `Portfolio snapshot ${new Date().toISOString().slice(0, 10)}`,
    summary: snapshot.summary || JSON.stringify(snapshot.summary || {}).slice(0, 500),
    tags: ['portfolio', 'snapshot'],
    source: 'portfolio_snapshot',
    sourceId: snapshot.id || `snapshot-${Date.now()}`,
    sensitivity: 'internal',
    confidence: 0.7,
    metadata: { projectCount: snapshot.projectCount, totalCost: snapshot.totalCost }
  }, services);
}

function ingestTask(task, services = {}) {
  if (!task) return { ok: false, error: 'NO_TASK' };
  return safeIngest('task', {
    title: task.title || 'Task',
    summary: task.description || task.summary || '',
    tags: ['task', task.type].filter(Boolean),
    source: 'operator_task',
    sourceId: task.id,
    sensitivity: 'internal',
    confidence: 0.8,
    linkedProjectId: task.goalId,
    linkedPhaseId: task.planId,
    metadata: { status: task.status, type: task.type, riskLevel: task.riskLevel }
  }, services);
}

function ingestIncident(incident, services = {}) {
  if (!incident) return { ok: false, error: 'NO_INCIDENT' };
  return safeIngest('incident', {
    title: incident.title || 'Production Incident',
    summary: incident.summary || incident.description || '',
    tags: ['incident', ...(incident.tags || []), incident.severity].filter(Boolean),
    source: 'observability_incident',
    sourceId: incident.id,
    sensitivity: 'internal',
    confidence: 0.95,
    linkedProjectId: incident.projectId,
    metadata: { severity: incident.severity, status: incident.status }
  }, services);
}

function ingestDeployReport(report, services = {}) {
  if (!report) return { ok: false, error: 'NO_REPORT' };
  return safeIngest('deploy', {
    title: report.title || `Deploy ${report.version || report.id || ''}`,
    summary: report.summary || report.description || '',
    tags: ['deploy', ...(report.tags || []), report.status].filter(Boolean),
    source: 'deploy_report',
    sourceId: report.id || `deploy-${Date.now()}`,
    sensitivity: 'internal',
    confidence: 0.9,
    linkedProjectId: report.projectId,
    metadata: { version: report.version, status: report.status, environment: report.environment }
  }, services);
}

function ingestRollbackPlan(plan, services = {}) {
  if (!plan) return { ok: false, error: 'NO_PLAN' };
  return safeIngest('rollback', {
    title: plan.title || 'Rollback Plan',
    summary: plan.summary || plan.description || '',
    tags: ['rollback', ...(plan.tags || [])].filter(Boolean),
    source: 'rollback_plan',
    sourceId: plan.id || `rollback-${Date.now()}`,
    sensitivity: 'internal',
    confidence: 0.9,
    linkedProjectId: plan.projectId,
    metadata: { targetVersion: plan.targetVersion, reason: plan.reason }
  }, services);
}

function ingestExecutorProposal(proposal, services = {}) {
  if (!proposal) return { ok: false, error: 'NO_PROPOSAL' };
  return safeIngest('proposal', {
    title: proposal.title || 'Executor Proposal',
    summary: proposal.summary || proposal.description || '',
    tags: ['proposal', ...(proposal.tags || []), proposal.actionType].filter(Boolean),
    source: 'executor_proposal',
    sourceId: proposal.id,
    sensitivity: 'internal',
    confidence: 0.85,
    linkedProjectId: proposal.projectId,
    metadata: { actionType: proposal.actionType, status: proposal.status, riskLevel: proposal.riskLevel }
  }, services);
}

function ingestPhaseSummary(phase, services = {}) {
  if (!phase) return { ok: false, error: 'NO_PHASE' };
  return safeIngest('phase', {
    title: phase.title || `Phase ${phase.number || ''}`,
    summary: phase.summary || phase.description || '',
    tags: ['phase', ...(phase.tags || [])].filter(Boolean),
    source: 'phase_summary',
    sourceId: phase.id || `phase-${phase.number || Date.now()}`,
    sensitivity: 'internal',
    confidence: 0.85,
    linkedPhaseId: phase.id,
    metadata: { number: phase.number, deliverables: phase.deliverables }
  }, services);
}

function ingestManualKnowledge(input, services = {}) {
  if (!input) return { ok: false, error: 'NO_INPUT' };
  if (input.type === 'decision') {
    return decisionMemory.recordDecisionMemory(input, services);
  }
  return safeIngest(input.type || 'memory', input, services);
}

module.exports = {
  safeIngest,
  linkToProject,
  linkToPhase,
  ingestProjectGoal,
  ingestOperatorPlan,
  ingestPortfolioSnapshot,
  ingestTask,
  ingestIncident,
  ingestDeployReport,
  ingestRollbackPlan,
  ingestExecutorProposal,
  ingestPhaseSummary,
  ingestManualKnowledge
};
