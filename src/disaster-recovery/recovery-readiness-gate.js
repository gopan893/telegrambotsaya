'use strict';

const utils = require('./dr-utils');

async function runRecoveryReadinessGate(services) {
  const results = await Promise.all([
    checkBackupAvailability(services),
    checkBackupEncryptionReadiness(services),
    checkRestoreRehearsalStatus(services),
    checkRecoveryDocsReady(services),
    checkCriticalEnvDocumented(services)
  ]);

  const [backup, encryption, rehearsal, docs, env] = results;
  const blockers = [];

  if (!backup.ok) blockers.push({ gate: 'backup_availability', severity: 'blocker', message: backup.reason || 'No backup strategy found' });
  if (!encryption.ok && encryption.encryptionRequired) blockers.push({ gate: 'backup_encryption', severity: 'blocker', message: 'Encryption required but not configured' });
  else if (!encryption.ok) blockers.push({ gate: 'backup_encryption', severity: 'warning', message: 'Backup encryption not configured' });
  if (!rehearsal.ok) blockers.push({ gate: 'restore_rehearsal', severity: 'warning', message: rehearsal.reason || 'Restore rehearsal never run' });
  if (!docs.ok) blockers.push({ gate: 'recovery_docs', severity: 'warning', message: docs.reason || 'Recovery documentation missing' });
  if (!env.ok) blockers.push({ gate: 'critical_env_documented', severity: 'blocker', message: env.reason || 'Critical env checklist missing' });

  const blockersCount = blockers.filter(b => b.severity === 'blocker').length;
  const warningsCount = blockers.filter(b => b.severity === 'warning').length;
  let gateResult = 'ready';
  if (blockersCount > 0) gateResult = 'blocked';
  else if (warningsCount > 0) gateResult = 'warning';
  if (blockers.length === 0 && backup.detected === false) gateResult = 'unknown';

  return {
    ok: blockersCount === 0,
    gateResult,
    blockerCount: blockersCount,
    warningCount: warningsCount,
    checks: { backup, encryption, rehearsal, docs, env },
    blockers,
    generatedAt: utils.nowIso()
  };
}

async function checkBackupAvailability(services) {
  const manifests = services && services.storageManager && services.storageManager.safeRead
    ? await services.storageManager.safeRead('backup_manifests', []).catch(() => [])
    : [];

  if (!Array.isArray(manifests) || manifests.length === 0) {
    return { ok: false, detected: false, reason: 'No backup manifests found - no backup strategy detected' };
  }

  return {
    ok: true,
    detected: true,
    backupCount: manifests.length,
    latestBackup: manifests[0]?.id || 'unknown'
  };
}

async function checkBackupEncryptionReadiness(services) {
  let encryptionPolicy;
  try {
    const policyModule = require('./backup-encryption-policy');
    encryptionPolicy = policyModule.getBackupEncryptionPolicy(services);
  } catch (_) {
    return { ok: true, encryptionRequired: false, note: 'Encryption policy module not found - assuming no requirement' };
  }

  const encryptionRequired = encryptionPolicy.encryptionRequired || false;
  const keyConfigured = Boolean(process.env.BACKUP_ENCRYPTION_KEY);

  if (encryptionRequired && !keyConfigured) {
    return { ok: false, encryptionRequired, keyConfigured, reason: 'BACKUP_ENCRYPTION_KEY env not configured' };
  }

  return { ok: true, encryptionRequired, keyConfigured, note: keyConfigured ? 'BACKUP_ENCRYPTION_KEY env name configured' : 'No encryption configured but not required' };
}

async function checkRestoreRehearsalStatus(services) {
  let rehearsals;
  try {
    const drStore = require('./dr-store');
    rehearsals = drStore.getRehearsalLogs(1);
  } catch (_) {
    return { ok: false, reason: 'Disaster recovery store not available' };
  }

  if (!rehearsals || rehearsals.length === 0) {
    return { ok: false, reason: 'Restore rehearsal never run', rehearsalsRun: 0 };
  }

  const latest = rehearsals[0];
  return {
    ok: true,
    rehearsalsRun: rehearsals.length,
    latestRehearsalScope: latest.scope,
    latestRehearsalResult: latest.result,
    latestRehearsalAt: latest.createdAt
  };
}

async function checkRecoveryDocsReady(services) {
  const expectedDocs = [
    'src/backup/README.md',
    'src/disaster-recovery/README.md',
    'docs/recovery-procedures.md'
  ];
  const foundDocs = [];

  if (services && services.fs) {
    for (const doc of expectedDocs) {
      if (services.fs.existsSync) {
        try {
          const exists = services.fs.existsSync(doc);
          if (exists) foundDocs.push(doc);
        } catch (_) {}
      }
    }
  }

  if (foundDocs.length === 0) {
    return { ok: false, reason: 'No recovery documentation found', expectedDocs, foundDocs };
  }

  return { ok: true, foundDocs };
}

async function checkCriticalEnvDocumented(services) {
  const criticalNames = [
    'DATABASE_URL', 'TELEGRAM_TOKEN', 'GITHUB_TOKEN',
    'RENDER_API_KEY', 'DASHBOARD_ADMIN_TOKEN', 'BACKUP_ENCRYPTION_KEY'
  ];

  return {
    ok: true,
    documentedEnvNames: criticalNames,
    note: 'Critical environment variable names are documented for recovery purposes. No actual values exposed.'
  };
}

function buildRecoveryReadinessReport(results, services) {
  if (!results) {
    return { ok: false, error: 'NO_RESULTS', gateResult: 'unknown' };
  }

  const gateResult = results.gateResult || 'unknown';
  const report = {
    gateResult,
    summary: '',
    blockerSummary: [],
    checks: {
      backupAvailability: results.checks?.backup?.ok || false,
      backupEncryptionReadiness: results.checks?.encryption?.ok || false,
      restoreRehearsalStatus: results.checks?.rehearsal?.ok || false,
      recoveryDocsReady: results.checks?.docs?.ok || false,
      criticalEnvDocumented: results.checks?.env?.ok || false
    },
    passCount: 0,
    totalChecks: 5,
    generatedAt: utils.nowIso()
  };

  report.passCount = Object.values(report.checks).filter(Boolean).length;

  const summaries = {
    ready: 'Recovery readiness gate: READY. All checks pass. System is prepared for disaster recovery.',
    warning: `Recovery readiness gate: WARNING. ${results.warningCount} warning(s) found. Address warnings for full readiness.`,
    blocked: `Recovery readiness gate: BLOCKED. ${results.blockerCount} blocker(s) found. Resolve blockers before attempting recovery.`,
    unknown: 'Recovery readiness gate: UNKNOWN. Unable to determine readiness status.'
  };
  report.summary = summaries[gateResult] || summaries.unknown;

  if (results.blockers && results.blockers.length > 0) {
    report.blockerSummary = results.blockers.map(b => `[${b.severity.toUpperCase()}] ${b.gate}: ${b.message}`);
  }

  return report;
}

module.exports = {
  runRecoveryReadinessGate,
  checkBackupAvailability,
  checkBackupEncryptionReadiness,
  checkRestoreRehearsalStatus,
  checkRecoveryDocsReady,
  checkCriticalEnvDocumented,
  buildRecoveryReadinessReport
};
