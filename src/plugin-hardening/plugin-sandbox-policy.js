'use strict';

const BLOCKED_ACTIONS = ['shell', 'arbitrary_filesystem_write', 'direct_token_access', 'direct_deploy', 'direct_push', 'direct_release', 'direct_rollback'];
const EXTERNAL_WRITE_PROPOSAL_ONLY = ['external_write', 'external_deploy', 'external_push', 'external_release', 'external_rollback', 'external_restore'];

function buildSandboxPolicy(manifest, permissions) {
  const policy = {
    pluginId: manifest && manifest.id,
    allowedGlobals: ['console', 'Buffer', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Promise', 'Math', 'Date', 'JSON', 'RegExp', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Map', 'Set', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent'],
    allowedResources: [],
    blockedActions: [...BLOCKED_ACTIONS],
    externalWriteProposalOnly: [...EXTERNAL_WRITE_PROPOSAL_ONLY],
    maxMemoryMB: 64,
    maxExecTimeMs: 30000,
    filesystem: { read: false, write: false, allowedPaths: [] },
    network: { enabled: false, allowedDomains: [], blockedDomains: [] },
    shell: { enabled: false },
    database: { read: false, write: false },
    secretAccess: { enabled: false },
    permissions: Array.isArray(permissions) ? [...permissions] : []
  };

  if (manifest && manifest.sandbox) {
    const sb = manifest.sandbox;
    if (sb.filesystem) {
      policy.filesystem.read = !!sb.filesystem.read;
      policy.filesystem.write = false;
      policy.filesystem.allowedPaths = Array.isArray(sb.filesystem.allowedPaths) ? sb.filesystem.allowedPaths : [];
    }
    if (sb.network) {
      policy.network.enabled = !!sb.network.enabled;
      policy.network.allowedDomains = Array.isArray(sb.network.allowedDomains) ? sb.network.allowedDomains : [];
    }
    if (sb.database) {
      policy.database.read = !!sb.database.read;
      policy.database.write = false;
    }
  }

  return policy;
}

function enforceSandboxPolicy(policy, action) {
  if (!policy || !action) return { allowed: false, reason: 'Invalid policy or action' };
  if (!action.type) return { allowed: false, reason: 'Action type required' };

  const actionType = action.type.toLowerCase();

  if (BLOCKED_ACTIONS.includes(actionType)) {
    return { allowed: false, reason: 'Action explicitly blocked by sandbox policy: ' + actionType };
  }

  if (actionType === 'shell' || actionType === 'exec' || actionType === 'spawn') {
    return { allowed: false, reason: 'Shell execution blocked by sandbox policy' };
  }

  if (actionType === 'filesystem_write' || actionType === 'write_file' || actionType === 'append_file') {
    return { allowed: false, reason: 'Filesystem write blocked by sandbox policy' };
  }

  if (actionType === 'token_access' || actionType === 'secret_read' || actionType === 'credential_access') {
    return { allowed: false, reason: 'Direct secret/token access blocked by sandbox policy' };
  }

  if (EXTERNAL_WRITE_PROPOSAL_ONLY.includes(actionType)) {
    return { allowed: false, reason: 'External write action requires proposal: ' + actionType };
  }

  if (actionType === 'network_request' || actionType === 'http_request') {
    if (!policy.network.enabled) {
      return { allowed: false, reason: 'Network access disabled by sandbox policy' };
    }
    if (action.domain && policy.network.allowedDomains.length > 0) {
      if (!policy.network.allowedDomains.includes(action.domain) && !policy.network.allowedDomains.includes('*')) {
        return { allowed: false, reason: 'Domain not in allowed list: ' + action.domain };
      }
    }
  }

  if (actionType === 'database_read') {
    if (!policy.database.read) return { allowed: false, reason: 'Database read disabled by sandbox policy' };
  }

  if (actionType === 'database_write') {
    return { allowed: false, reason: 'Database write blocked by sandbox policy' };
  }

  if (actionType === 'read_file' || actionType === 'filesystem_read') {
    if (!policy.filesystem.read) return { allowed: false, reason: 'Filesystem read disabled by sandbox policy' };
    if (action.path && policy.filesystem.allowedPaths.length > 0) {
      const allowed = policy.filesystem.allowedPaths.some(p => action.path.startsWith(p));
      if (!allowed) return { allowed: false, reason: 'Path not allowed: ' + action.path };
    }
  }

  return { allowed: true };
}

function validateSandboxPolicy(policy) {
  const errors = [];
  if (!policy) return { valid: false, errors: ['No policy provided'] };
  if (!policy.pluginId) errors.push('Missing pluginId');
  if (policy.filesystem && policy.filesystem.write) errors.push('Filesystem write must not be enabled in sandbox policy');
  if (policy.shell && policy.shell.enabled) errors.push('Shell must not be enabled in sandbox policy');
  if (policy.secretAccess && policy.secretAccess.enabled) errors.push('Secret access must not be enabled in sandbox policy');
  return { valid: errors.length === 0, errors };
}

function summarizePolicy(policy) {
  if (!policy) return { blocked: true, reason: 'No policy' };
  return {
    pluginId: policy.pluginId,
    filesystemRead: !!(policy.filesystem && policy.filesystem.read),
    filesystemWrite: false,
    networkEnabled: !!(policy.network && policy.network.enabled),
    shellEnabled: false,
    databaseRead: !!(policy.database && policy.database.read),
    databaseWrite: false,
    secretAccess: false,
    blockedActions: policy.blockedActions ? policy.blockedActions.length : 0,
    externalWriteProposalOnly: policy.externalWriteProposalOnly ? policy.externalWriteProposalOnly.length : 0,
    maxMemoryMB: policy.maxMemoryMB || 64,
    maxExecTimeMs: policy.maxExecTimeMs || 30000
  };
}

module.exports = { buildSandboxPolicy, enforceSandboxPolicy, validateSandboxPolicy, summarizePolicy, BLOCKED_ACTIONS, EXTERNAL_WRITE_PROPOSAL_ONLY };
