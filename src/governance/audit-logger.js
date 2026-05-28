'use strict';

const observability = require('../agents/observability');

const MAX_AUDIT_EVENTS = 160;
const auditEvents = [];

function sanitizeParams(params = {}) {
  const clone = {};
  for (const [key, value] of Object.entries(params || {})) {
    const lower = String(key).toLowerCase();
    if (/(token|secret|password|key|credential)/.test(lower)) {
      clone[key] = '[REDACTED]';
    } else {
      clone[key] = typeof value === 'string' ? value.slice(0, 220) : value;
    }
  }
  return clone;
}

function pushAuditEvent(traceId, type, payload = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    traceId,
    type,
    ...payload
  };

  auditEvents.push(event);
  if (auditEvents.length > MAX_AUDIT_EVENTS) auditEvents.shift();

  observability.logEvent(traceId, 'AuditLogger', type, {
    intent: payload.intent,
    decision: payload.decision,
    riskLevel: payload.riskLevel,
    allowed: payload.allowed
  });

  return event;
}

function logDecision(traceId, decision = {}) {
  return pushAuditEvent(traceId, 'DECISION_AUDIT_TRAIL', {
    userId: String(decision.userId || ''),
    intent: decision.intent,
    decision: decision.decision,
    allowed: decision.executionAllowed,
    riskLevel: decision.risk?.riskLevel,
    riskScore: decision.risk?.riskScore,
    policy: decision.policy?.capability,
    violations: decision.violations || [],
    explanation: decision.explanation
  });
}

function logToolExecution(traceId, input = {}) {
  return pushAuditEvent(traceId, 'TOOL_EXECUTION_GOVERNANCE_LOG', {
    userId: String(input.userId || ''),
    intent: input.intent,
    params: sanitizeParams(input.params || {}),
    riskLevel: input.riskLevel,
    success: !!input.success,
    error: input.error || null
  });
}

function logMemoryMutation(traceId, input = {}) {
  return pushAuditEvent(traceId, 'MEMORY_MODIFICATION_LOG', {
    userId: String(input.userId || ''),
    scope: input.scope,
    action: input.action,
    riskLevel: input.riskLevel || 'medium'
  });
}

function getAuditEvents(limit = 20) {
  return auditEvents.slice(-limit);
}

function getAnalytics() {
  const recent = auditEvents.slice(-80);
  const byDecision = {};
  const byRisk = {};
  let blocked = 0;
  let approvals = 0;

  for (const event of recent) {
    if (event.decision) byDecision[event.decision] = (byDecision[event.decision] || 0) + 1;
    if (event.riskLevel) byRisk[event.riskLevel] = (byRisk[event.riskLevel] || 0) + 1;
    if (event.allowed === false) blocked++;
    if (event.decision === 'APPROVAL_REQUIRED') approvals++;
  }

  return {
    recentAuditCount: recent.length,
    blockedCount: blocked,
    approvalRequestCount: approvals,
    byDecision,
    byRisk,
    latestEvents: getAuditEvents(8)
  };
}

module.exports = {
  logDecision,
  logToolExecution,
  logMemoryMutation,
  getAuditEvents,
  getAnalytics,
  sanitizeParams
};
