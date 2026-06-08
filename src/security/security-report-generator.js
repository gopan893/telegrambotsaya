'use strict';

const crypto = require('crypto');

const REPORTS = [];

function generateId() {
  return crypto.createHash('sha1').update(`sr:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

function generateFullSecurityReport(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'full_security',
    summary: 'Full security report generated.',
    findings: [],
    score: null,
    createdAt: new Date().toISOString()
  };
}

function generateSecretAuditReport(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'secret_audit',
    summary: 'Secret audit completed.',
    totalFindings: 0,
    criticalFindings: 0,
    createdAt: new Date().toISOString()
  };
}

function generateEnvDriftReport(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'env_drift',
    summary: 'Environment drift check completed.',
    issues: [],
    createdAt: new Date().toISOString()
  };
}

function generatePermissionAuditReport(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'permission_audit',
    summary: 'Permission audit completed.',
    findings: [],
    createdAt: new Date().toISOString()
  };
}

function generateRedTeamReport(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'redteam',
    summary: 'Red-team simulation completed.',
    cases: [],
    score: 0,
    createdAt: new Date().toISOString()
  };
}

function generateApprovalBypassReport(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'approval_bypass',
    summary: 'Approval bypass audit completed.',
    paths: [],
    allBlocked: true,
    createdAt: new Date().toISOString()
  };
}

function generateSecurityExecutiveSummary(workspaceId, services) {
  return {
    id: generateId(),
    workspaceId: workspaceId || 'default',
    type: 'executive_summary',
    summary: 'Security executive summary.',
    score: null,
    recommendations: [],
    createdAt: new Date().toISOString()
  };
}

function getReport(reportId) {
  return REPORTS.find(r => r.id === reportId) || null;
}

function listReports({ type, limit } = {}) {
  let results = [...REPORTS];
  if (type) results = results.filter(r => r.type === type);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (limit) results = results.slice(0, limit);
  return results;
}

module.exports = {
  generateFullSecurityReport,
  generateSecretAuditReport,
  generateEnvDriftReport,
  generatePermissionAuditReport,
  generateRedTeamReport,
  generateApprovalBypassReport,
  generateSecurityExecutiveSummary,
  getReport,
  listReports
};
