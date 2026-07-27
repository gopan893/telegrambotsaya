'use strict';

const DANGEROUS_PERMISSIONS = ['shell', 'filesystem_write', 'network_external', 'token_access', 'deploy', 'push', 'release', 'rollback', 'restore', 'credential_access'];
const SENSITIVE_PERMISSIONS = ['database_write', 'config_write', 'user_data_access', 'secret_read'];

function createPermissionVersion(pluginId, permissions) {
  return {
    pluginId,
    permissions: Array.isArray(permissions) ? [...permissions] : [],
    version: 1,
    createdAt: new Date().toISOString(),
    history: [{ version: 1, permissions: Array.isArray(permissions) ? [...permissions] : [], changedAt: new Date().toISOString(), reason: 'initial' }]
  };
}

function bumpPermissionVersion(currentVersion, newPermissions, reason) {
  if (!currentVersion || typeof currentVersion !== 'object') return null;
  const oldPerms = currentVersion.permissions || [];
  const newPerms = Array.isArray(newPermissions) ? [...newPermissions] : oldPerms;
  return {
    ...currentVersion,
    permissions: newPerms,
    version: (currentVersion.version || 0) + 1,
    updatedAt: new Date().toISOString(),
    history: [...(currentVersion.history || []), { version: (currentVersion.version || 0) + 1, permissions: newPerms, changedAt: new Date().toISOString(), reason: reason || 'update' }]
  };
}

function detectEscalation(oldPermissions, newPermissions) {
  const oldSet = new Set(oldPermissions || []);
  const newSet = new Set(newPermissions || []);
  const added = [...newSet].filter(p => !oldSet.has(p));
  const escalated = added.filter(p => DANGEROUS_PERMISSIONS.includes(p) || SENSITIVE_PERMISSIONS.includes(p));
  const dangerousAdded = added.filter(p => DANGEROUS_PERMISSIONS.includes(p));
  const sensitiveAdded = added.filter(p => SENSITIVE_PERMISSIONS.includes(p));

  return {
    hasEscalation: escalated.length > 0,
    added,
    escalated,
    dangerousAdded,
    sensitiveAdded,
    risk: dangerousAdded.length > 0 ? 'high' : sensitiveAdded.length > 0 ? 'medium' : escalated.length > 0 ? 'low' : 'none'
  };
}

function detectPermissionDrift(versionA, versionB) {
  if (!versionA || !versionB) return { drift: false, permissions: [] };
  const permsA = new Set(versionA.permissions || []);
  const permsB = new Set(versionB.permissions || []);
  const onlyInA = [...permsA].filter(p => !permsB.has(p));
  const onlyInB = [...permsB].filter(p => !permsA.has(p));
  const drifted = [...onlyInA, ...onlyInB];
  return { drift: drifted.length > 0, onlyInA, onlyInB, permissions: drifted };
}

function summarizePermissions(permissions) {
  const summary = { total: permissions.length, dangerous: [], sensitive: [], safe: [] };
  for (const perm of permissions) {
    if (DANGEROUS_PERMISSIONS.includes(perm)) summary.dangerous.push(perm);
    else if (SENSITIVE_PERMISSIONS.includes(perm)) summary.sensitive.push(perm);
    else summary.safe.push(perm);
  }
  summary.risk = summary.dangerous.length > 0 ? 'high' : summary.sensitive.length > 0 ? 'medium' : 'low';
  return summary;
}

function checkPermissionConsistency(pluginVersions) {
  const issues = [];
  if (!Array.isArray(pluginVersions) || pluginVersions.length < 2) return { consistent: true, issues };
  for (let i = 1; i < pluginVersions.length; i++) {
    const prev = pluginVersions[i - 1];
    const curr = pluginVersions[i];
    if (curr.version <= prev.version) {
      issues.push({ pluginId: curr.pluginId, issue: 'Version not incremented', prev: prev.version, current: curr.version });
    }
    const drift = detectPermissionDrift(prev, curr);
    if (drift.drift && curr.version === prev.version) {
      issues.push({ pluginId: curr.pluginId, issue: 'Permissions changed without version bump', changed: drift.permissions });
    }
  }
  return { consistent: issues.length === 0, issues };
}

module.exports = {
  createPermissionVersion, bumpPermissionVersion, detectEscalation,
  detectPermissionDrift, summarizePermissions, checkPermissionConsistency,
  DANGEROUS_PERMISSIONS, SENSITIVE_PERMISSIONS
};
