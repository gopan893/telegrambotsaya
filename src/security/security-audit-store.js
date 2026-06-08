'use strict';

const crypto = require('crypto');

const AUDITS = [];

function generateId() {
  return crypto.createHash('sha1').update(`sec:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

const AUDIT_TYPES = [
  'full_security_audit', 'secret_scan', 'env_drift',
  'permission_audit', 'capability_audit', 'approval_bypass_audit',
  'redteam_audit', 'rotation_planning'
];

function createAuditRun({ workspaceId, userId, type, severity }) {
  if (!AUDIT_TYPES.includes(type)) throw new Error(`Unknown audit type: ${type}`);
  const audit = {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    userId: userId || 'system',
    type,
    status: 'started',
    severity: severity || 'info',
    findingsCount: 0,
    criticalFindingsCount: 0,
    reportId: null,
    rotationPlanIds: [],
    proposalIds: [],
    startedAt: new Date().toISOString(),
    completedAt: null
  };
  AUDITS.push(audit);
  return audit;
}

function completeAuditRun(auditId, updates) {
  const audit = AUDITS.find(a => a.id === auditId);
  if (!audit) return null;
  Object.assign(audit, updates, { status: 'completed', completedAt: new Date().toISOString() });
  return audit;
}

function failAuditRun(auditId, reason) {
  const audit = AUDITS.find(a => a.id === auditId);
  if (!audit) return null;
  audit.status = 'failed';
  audit.failReason = reason;
  audit.completedAt = new Date().toISOString();
  return audit;
}

function getAuditRun(auditId) {
  return AUDITS.find(a => a.id === auditId) || null;
}

function listAuditRuns({ type, status, limit } = {}) {
  let results = [...AUDITS];
  if (type) results = results.filter(a => a.type === type);
  if (status) results = results.filter(a => a.status === status);
  results.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  if (limit) results = results.slice(0, limit);
  return results;
}

function getAuditStats() {
  return {
    total: AUDITS.length,
    byType: AUDIT_TYPES.reduce((acc, t) => { acc[t] = AUDITS.filter(a => a.type === t).length; return acc; }, {}),
    byStatus: {
      started: AUDITS.filter(a => a.status === 'started').length,
      completed: AUDITS.filter(a => a.status === 'completed').length,
      failed: AUDITS.filter(a => a.status === 'failed').length,
      blocked: AUDITS.filter(a => a.status === 'blocked').length
    },
    totalFindings: AUDITS.reduce((s, a) => s + (a.findingsCount || 0), 0),
    totalCritical: AUDITS.reduce((s, a) => s + (a.criticalFindingsCount || 0), 0)
  };
}

module.exports = {
  AUDIT_TYPES,
  createAuditRun,
  completeAuditRun,
  failAuditRun,
  getAuditRun,
  listAuditRuns,
  getAuditStats
};
