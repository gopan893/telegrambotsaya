'use strict';

const AUDIT_LOG = [];
const MAX_AUDIT_EVENTS = 500;

function recordGovernanceDecision(decision) {
  if (!decision) return null;

  const auditEvent = {
    id: `gov_audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: decision.workspaceId || 'default',
    actorId: String(decision.role || decision.actorId || 'unknown').slice(0, 40),
    module: decision.capabilityId ? decision.capabilityId.split('.')[0] : 'unknown',
    capabilityId: decision.capabilityId || 'unknown',
    actionType: decision.outcome || 'unknown',
    riskLevel: decision.riskLevel || 'unknown',
    decision: decision.allowed ? 'ALLOWED' : (decision.blocked ? 'BLOCKED' : 'PROPOSAL_REQUIRED'),
    reasons: (decision.reasons || []).slice(0, 5),
    proposalId: null,
    evaluationRunId: decision.evalCase ? decision.evalCase.caseId : null,
    createdAt: new Date().toISOString()
  };

  AUDIT_LOG.push(auditEvent);
  if (AUDIT_LOG.length > MAX_AUDIT_EVENTS) AUDIT_LOG.shift();

  return auditEvent;
}

function listGovernanceAudit(filters) {
  let result = [...AUDIT_LOG];
  if (filters) {
    if (filters.module) result = result.filter(e => e.module === filters.module);
    if (filters.riskLevel) result = result.filter(e => e.riskLevel === filters.riskLevel);
    if (filters.decision) result = result.filter(e => e.decision === filters.decision);
    if (filters.limit) result = result.slice(-filters.limit);
  }
  return result.slice(-100);
}

function summarizeGovernanceAudit(filters) {
  const events = listGovernanceAudit(filters);
  const summary = {
    total: events.length,
    allowed: events.filter(e => e.decision === 'ALLOWED').length,
    blocked: events.filter(e => e.decision === 'BLOCKED').length,
    proposals: events.filter(e => e.decision === 'PROPOSAL_REQUIRED').length,
    byRisk: {},
    byModule: {}
  };

  for (const event of events) {
    summary.byRisk[event.riskLevel] = (summary.byRisk[event.riskLevel] || 0) + 1;
    summary.byModule[event.module] = (summary.byModule[event.module] || 0) + 1;
  }

  return summary;
}

function sanitizeGovernanceAudit(event) {
  if (!event) return null;
  const sanitized = { ...event };

  if (sanitized.actorId && sanitized.actorId.length > 8) {
    sanitized.actorId = sanitized.actorId.slice(0, 4) + '...' + sanitized.actorId.slice(-4);
  }

  sanitized.reasons = (sanitized.reasons || []).slice(0, 3);

  delete sanitized.rawPayload;
  delete sanitized.internalNotes;

  return sanitized;
}

function getAuditStats() {
  return {
    totalEvents: AUDIT_LOG.length,
    maxEvents: MAX_AUDIT_EVENTS,
    recentSummary: summarizeGovernanceAudit({ limit: 50 })
  };
}

function resetAudit() {
  AUDIT_LOG.length = 0;
}

module.exports = {
  recordGovernanceDecision,
  listGovernanceAudit,
  summarizeGovernanceAudit,
  sanitizeGovernanceAudit,
  getAuditStats,
  resetAudit
};
