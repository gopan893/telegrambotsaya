'use strict';

const utils = require('./dr-utils');

let integrityChecker = null;
try {
  integrityChecker = require('../backup/integrity-checker');
} catch (_) {}

async function _readFallback(key, fallback, services) {
  if (services && services.storageManager && services.storageManager.safeRead) {
    try { return await services.storageManager.safeRead(key, fallback); } catch (_) {}
  }
  return fallback;
}

async function checkBackupInventory(services) {
  const manifests = await _readFallback('backup_manifests', [], services);

  return {
    ok: manifests.length > 0,
    totalBackups: manifests.length,
    scopes: [...new Set((Array.isArray(manifests) ? manifests : []).map(m => m.scope || m.type || 'unknown'))],
    latestBackupId: Array.isArray(manifests) && manifests.length > 0 ? manifests[0].id || 'unknown' : null,
    degraded: !integrityChecker,
    warning: integrityChecker ? undefined : 'Backup integrity checker module not found - running in degraded mode'
  };
}

async function checkBackupMetadataIntegrity(services) {
  const manifests = await _readFallback('backup_manifests', [], services);
  const issues = [];

  if (!Array.isArray(manifests) || manifests.length === 0) {
    return { ok: false, issues: [{ type: 'NO_MANIFESTS', message: 'No backup manifests found' }], note: 'Metadata check is read-only. No raw backup contents displayed.' };
  }

  for (const manifest of manifests) {
    if (!manifest.id) issues.push({ type: 'MISSING_ID', message: 'Backup manifest missing id' });
    if (!manifest.createdAt && !manifest.created_at) {
      issues.push({ type: 'MISSING_TIMESTAMP', manifestId: manifest.id || 'unknown' });
    }
  }

  return {
    ok: issues.length === 0,
    totalManifests: manifests.length,
    issues,
    note: 'Metadata check is read-only. No raw backup contents displayed.'
  };
}

async function checkBackupEncryptionStatus(services) {
  const manifests = await _readFallback('backup_manifests', [], services);
  const encryptionAlgorithms = [...new Set((Array.isArray(manifests) ? manifests : [])
    .map(m => m.encryptionAlgorithm || m.encryption_algorithm || m.algorithm || 'none'))];

  const encryptedCount = (Array.isArray(manifests) ? manifests : [])
    .filter(m => (m.encryptionAlgorithm || m.encryption_algorithm || m.algorithm || 'none') !== 'none').length;

  return {
    ok: encryptedCount > 0,
    totalBackups: manifests.length,
    encryptedCount,
    unencryptedCount: manifests.length - encryptedCount,
    algorithmsInUse: encryptionAlgorithms,
    suggestion: encryptedCount === 0 ? 'No encrypted backups found. Enable backup encryption policy and re-encrypt backups.' : undefined,
    note: 'Read-only check. No secret values exposed.'
  };
}

async function checkBackupRestoreReadiness(services) {
  const manifests = await _readFallback('backup_manifests', [], services);

  if (!Array.isArray(manifests) || manifests.length === 0) {
    return { ok: false, ready: false, reason: 'NO_BACKUPS_AVAILABLE' };
  }

  const hasValidManifest = manifests.some(m => m.id && (m.createdAt || m.created_at));
  const hasEncryption = manifests.some(m =>
    (m.encryptionAlgorithm || m.encryption_algorithm || m.algorithm) &&
    (m.encryptionAlgorithm || m.encryption_algorithm || m.algorithm) !== 'none');

  const readiness = hasValidManifest ? 'ready' : 'degraded';

  return {
    ok: readiness === 'ready',
    ready: readiness === 'ready',
    manifestCount: manifests.length,
    encryptedBackupsAvailable: hasEncryption,
    restorePathAvailable: readiness === 'ready',
    note: 'Restore path requires rehearsal run and executor approval before actual restore.'
  };
}

async function buildBackupIntegrityReport(results, services) {
  const inventory = results && results.inventory ? results.inventory : await checkBackupInventory(services);
  const metadata = results && results.metadata ? results.metadata : await checkBackupMetadataIntegrity(services);
  const encryption = results && results.encryption ? results.encryption : await checkBackupEncryptionStatus(services);
  const readiness = results && results.readiness ? results.readiness : await checkBackupRestoreReadiness(services);

  const issues = [];
  if (!inventory.ok) issues.push({ check: 'inventory', message: 'Backup inventory check failed' });
  if (!metadata.ok) issues.push({ check: 'metadata', message: 'Backup metadata integrity issues found' });
  if (!encryption.ok) issues.push({ check: 'encryption', message: 'Backup encryption not enabled' });
  if (!readiness.ok) issues.push({ check: 'readiness', message: 'Backup restore readiness check failed' });

  return {
    ok: issues.length === 0,
    degraded: !integrityChecker,
    checks: {
      inventory: { ok: inventory.ok, totalBackups: inventory.totalBackups },
      metadata: { ok: metadata.ok, totalManifests: metadata.totalManifests, issuesCount: metadata.issues ? metadata.issues.length : 0 },
      encryption: { ok: encryption.ok, encryptedCount: encryption.encryptedCount },
      readiness: { ok: readiness.ok, ready: readiness.ready }
    },
    issues,
    degradedWarning: inventory.degraded ? inventory.warning : undefined,
    generatedAt: utils.nowIso()
  };
}

module.exports = {
  checkBackupInventory,
  checkBackupMetadataIntegrity,
  checkBackupEncryptionStatus,
  checkBackupRestoreReadiness,
  buildBackupIntegrityReport
};
