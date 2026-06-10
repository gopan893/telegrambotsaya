'use strict';

const HIGH_RISK_PERMISSIONS = ['write', 'admin', 'delete', 'deploy', 'push', 'release', 'rollback'];
const SENSITIVE_PERMISSIONS = ['read', 'token', 'secret', 'credential', 'user_data'];

function auditConnectorPermissions(connector, manifest) {
  const findings = [];
  const connectorPerms = connector && connector.permissions ? connector.permissions : [];
  const manifestPerms = manifest && manifest.permissions ? manifest.permissions : [];
  const allPerms = [...new Set([...connectorPerms, ...manifestPerms])];

  const highRisk = allPerms.filter(p => HIGH_RISK_PERMISSIONS.some(r => p.toLowerCase().includes(r)));
  const sensitive = allPerms.filter(p => SENSITIVE_PERMISSIONS.some(r => p.toLowerCase().includes(r)));

  if (highRisk.length > 0) {
    findings.push({ severity: 'high', type: 'high_risk_permissions', permissions: highRisk, message: 'Connector has high-risk permissions' });
  }

  if (sensitive.length > 0) {
    findings.push({ severity: 'medium', type: 'sensitive_permissions', permissions: sensitive, message: 'Connector has sensitive permissions' });
  }

  if (connector && connector.type === 'read' && highRisk.some(p => p.includes('write') || p.includes('delete'))) {
    findings.push({ severity: 'high', type: 'permission_mismatch', message: 'Read-only connector has write permissions' });
  }

  const hasAdmin = allPerms.some(p => p.toLowerCase().includes('admin'));
  if (hasAdmin) {
    findings.push({ severity: 'high', type: 'admin_permission', message: 'Connector has admin permissions' });
  }

  return {
    connectorId: connector && connector.id,
    totalPermissions: allPerms.length,
    highRisk: highRisk.length,
    sensitive: sensitive.length,
    findings,
    risk: highRisk.length > 0 ? 'high' : sensitive.length > 0 ? 'medium' : 'low'
  };
}

function checkPermissionEscalation(oldPermissions, newPermissions) {
  const oldSet = new Set(oldPermissions || []);
  const newSet = new Set(newPermissions || []);
  const added = [...newSet].filter(p => !oldSet.has(p));
  const removed = [...oldSet].filter(p => !newSet.has(p));
  const escalated = added.filter(p => HIGH_RISK_PERMISSIONS.some(r => p.toLowerCase().includes(r)));

  return {
    escalated: escalated.length > 0,
    added,
    newPermissions: added,
    removed,
    escalatedPermissions: escalated,
    risk: escalated.length > 0 ? 'high' : added.length > 0 ? 'medium' : 'low'
  };
}

function validatePermissionScope(connector, scope) {
  if (!connector || !scope) return { valid: false, reason: 'Missing connector or scope' };
  if (typeof scope === 'string') scope = { required: [scope] };
  const perms = connector.permissions || [];
  const required = scope.required || [];
  const forbidden = scope.forbidden || [];

  const missing = required.filter(p => !perms.includes(p));
  const violatesForbidden = perms.filter(p => forbidden.includes(p));

  return {
    valid: missing.length === 0 && violatesForbidden.length === 0,
    missing,
    violatesForbidden,
    hasAllRequired: missing.length === 0,
    hasNoForbidden: violatesForbidden.length === 0
  };
}

function summarizeAudit(auditResult) {
  if (!auditResult) return {};
  return {
    connectorId: auditResult.connectorId,
    totalPermissions: auditResult.totalPermissions,
    risk: auditResult.risk,
    findings: auditResult.findings.length,
    highRiskFindings: auditResult.findings.filter(f => f.severity === 'high').length
  };
}

module.exports = {
  auditConnectorPermissions, checkPermissionEscalation, validatePermissionScope,
  summarizeAudit, HIGH_RISK_PERMISSIONS, SENSITIVE_PERMISSIONS
};
