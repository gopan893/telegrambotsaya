'use strict';

const BLOCK_REASONS = ['invalid_manifest', 'secret_access_requested', 'shell_requested', 'direct_deploy_requested', 'direct_push_requested', 'direct_release_requested', 'direct_rollback_requested', 'missing_required_permissions', 'sandbox_violation'];

function checkManifestValidity(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { passed: false, reason: 'invalid_manifest', errors: ['Manifest must be an object'] };
  if (!manifest.id) errors.push('Missing id');
  if (!manifest.name) errors.push('Missing name');
  if (!manifest.version) errors.push('Missing version');
  if (!manifest.main) errors.push('Missing main');
  if (!/^\d+\.\d+\.\d+/.test(manifest.version || '')) errors.push('Invalid version format');
  return { passed: errors.length === 0, reason: errors.length > 0 ? 'invalid_manifest' : null, errors };
}

function checkSecretAccess(manifest) {
  const perms = manifest && manifest.permissions ? manifest.permissions : [];
  const secretPerms = perms.filter(p => {
    const lower = String(p).toLowerCase();
    return lower.includes('secret') || lower.includes('token') || lower.includes('credential') || lower.includes('api_key');
  });
  if (secretPerms.length > 0) {
    return { passed: false, reason: 'secret_access_requested', details: secretPerms };
  }
  return { passed: true, reason: null };
}

function checkShellAccess(manifest) {
  const perms = manifest && manifest.permissions ? manifest.permissions : [];
  const shellPerms = perms.filter(p => {
    const lower = String(p).toLowerCase();
    return lower.includes('shell') || lower.includes('exec') || lower.includes('spawn') || lower.includes('system');
  });
  const sandbox = manifest && manifest.sandbox;
  if (sandbox && sandbox.shell && sandbox.shell.enabled) {
    shellPerms.push('sandbox_shell_enabled');
  }
  if (shellPerms.length > 0) {
    return { passed: false, reason: 'shell_requested', details: shellPerms };
  }
  return { passed: true, reason: null };
}

function checkDirectDeploy(manifest) {
  const perms = manifest && manifest.permissions ? manifest.permissions : [];
  const deployPerms = perms.filter(p => {
    const lower = String(p).toLowerCase();
    return lower.includes('deploy') || lower.includes('push') || lower.includes('release') || lower.includes('rollback');
  });
  if (deployPerms.length > 0) {
    return { passed: false, reason: 'direct_deploy_requested', details: deployPerms };
  }
  return { passed: true, reason: null };
}

function checkSandboxCompliance(manifest) {
  const violations = [];
  const sandbox = manifest && manifest.sandbox;
  if (!sandbox) return { passed: true, reason: null };
  if (sandbox.filesystem && sandbox.filesystem.write) violations.push('filesystem_write_enabled');
  if (sandbox.shell && sandbox.shell.enabled) violations.push('shell_enabled');
  if (sandbox.network && sandbox.network.enabled && (!sandbox.network.allowedDomains || sandbox.network.allowedDomains.includes('*'))) {
    violations.push('unrestricted_network');
  }
  if (violations.length > 0) {
    return { passed: false, reason: 'sandbox_violation', details: violations };
  }
  return { passed: true, reason: null };
}

function checkConnectorRequirements(manifest, registeredConnectors) {
  const connectors = manifest && manifest.connectors ? manifest.connectors : [];
  const missing = [];
  const registered = registeredConnectors || [];
  for (const conn of connectors) {
    const connId = typeof conn === 'string' ? conn : conn.id;
    const found = registered.find(c => c.id === connId || c.type === connId);
    if (!found) missing.push(connId);
  }
  if (missing.length > 0) {
    return { passed: false, reason: 'missing_connector', details: missing };
  }
  return { passed: true, reason: null };
}

function runCertification(manifest, context) {
  const checks = [
    { name: 'manifest_validity', check: () => checkManifestValidity(manifest) },
    { name: 'secret_access', check: () => checkSecretAccess(manifest) },
    { name: 'shell_access', check: () => checkShellAccess(manifest) },
    { name: 'direct_deploy', check: () => checkDirectDeploy(manifest) },
    { name: 'sandbox_compliance', check: () => checkSandboxCompliance(manifest) }
  ];

  if (context && context.registeredConnectors) {
    checks.push({ name: 'connector_requirements', check: () => checkConnectorRequirements(manifest, context.registeredConnectors) });
  }

  const results = [];
  let certified = true;
  let blockReason = null;

  for (const { name, check } of checks) {
    try {
      const result = check();
      results.push({ name, ...result });
      if (!result.passed) {
        certified = false;
        if (!blockReason) blockReason = result.reason;
      }
    } catch (err) {
      results.push({ name, passed: false, reason: 'check_error', errors: [err.message] });
      certified = false;
      if (!blockReason) blockReason = 'check_error';
    }
  }

  return {
    certified,
    blockReason,
    checks: results,
    pluginId: manifest && manifest.id,
    certifiedAt: certified ? new Date().toISOString() : null,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  checkManifestValidity, checkSecretAccess, checkShellAccess,
  checkDirectDeploy, checkSandboxCompliance, checkConnectorRequirements,
  runCertification, BLOCK_REASONS
};
