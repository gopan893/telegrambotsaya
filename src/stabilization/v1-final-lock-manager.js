'use strict';

const store = require('./stabilization-store');
const utils = require('./stabilization-utils');

const ALLOWED_CHANGE_TYPES = new Set([
  'p0-bug-fix', 'p1-bug-fix', 'dashboard-menu-fix', 'dashboard-content-fix',
  'api-contract-fix', 'pwa-cache-fix', 'secret-redaction-fix', 'approval-boundary-fix',
  'docs-update', 'test-update', 'registry-consistency-fix'
]);

const BLOCKED_CHANGE_PATTERNS = [
  /new.feature.module/i, /new.connector/i, /direct.deploy/i, /direct.push/i,
  /direct.restore/i, /shell.executor/i, /large.refactor/i, /framework.migration/i,
  /auto.approve/i, /auto.run/i
];

function buildDefaultLock(workspaceId) {
  return {
    id: `v1-lock:${workspaceId || 'default'}`,
    workspaceId: workspaceId || 'default',
    version: '1.0.0',
    status: 'checking',
    hotfixADStatus: 'checking',
    controlPanelStatus: 'checking',
    apiContractStatus: 'checking',
    pwaMobileStatus: 'checking',
    telegramStatus: 'checking',
    safetyBoundaryStatus: 'checking',
    securityStatus: 'checking',
    privacyStatus: 'checking',
    blockers: [],
    warnings: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function startV1FinalLock(services) {
  const lock = buildDefaultLock(services?.workspaceId);
  const saved = store.setV1FinalLock(lock, services?.workspaceId);
  return saved;
}

async function getV1FinalLockStatus(services) {
  const lock = store.getV1FinalLock(services?.workspaceId);
  if (!lock) return { status: 'not_started', message: 'V1 final lock has not been started.' };
  return lock;
}

async function blockFeatureWorkDuringV1Lock(change, services) {
  if (!change || !change.type) return { allowed: false, reason: 'Change type required.' };
  if (ALLOWED_CHANGE_TYPES.has(change.type)) return { allowed: true };
  for (const pattern of BLOCKED_CHANGE_PATTERNS) {
    if (pattern.test(change.type) || pattern.test(change.description || '')) {
      return { allowed: false, reason: `Change type "${change.type}" is blocked during V1 stabilization lock. Only P0/P1 fixes, docs, and test updates allowed.` };
    }
  }
  if (change.type.startsWith('new-') || change.type.startsWith('feature-')) {
    return { allowed: false, reason: 'New features are blocked during V1 stabilization lock.' };
  }
  return { allowed: true };
}

async function allowOnlyStabilityFix(change, services) {
  return blockFeatureWorkDuringV1Lock(change, services);
}

async function buildV1FinalLockReport(services) {
  const lock = store.getV1FinalLock(services?.workspaceId);
  if (!lock) return { status: 'not_started', message: 'V1 final lock has not been started.' };
  const blockerCount = (lock.blockers || []).length;
  const warningCount = (lock.warnings || []).length;
  const statuses = [lock.hotfixADStatus, lock.controlPanelStatus, lock.apiContractStatus, lock.pwaMobileStatus, lock.telegramStatus, lock.safetyBoundaryStatus, lock.securityStatus, lock.privacyStatus];
  const locked = statuses.filter(s => s === 'locked').length;
  const total = statuses.length;
  const score = utils.buildScore(locked, total);
  return {
    id: lock.id,
    version: lock.version,
    status: lock.status,
    score,
    lockedCount: locked,
    totalChecks: total,
    blockerCount,
    warningCount,
    blockers: lock.blockers || [],
    warnings: lock.warnings || [],
    details: {
      hotfixAD: lock.hotfixADStatus,
      controlPanel: lock.controlPanelStatus,
      apiContract: lock.apiContractStatus,
      pwaMobile: lock.pwaMobileStatus,
      telegram: lock.telegramStatus,
      safetyBoundary: lock.safetyBoundaryStatus,
      security: lock.securityStatus,
      privacy: lock.privacyStatus
    },
    createdAt: lock.createdAt,
    updatedAt: lock.updatedAt
  };
}

module.exports = { startV1FinalLock, getV1FinalLockStatus, blockFeatureWorkDuringV1Lock, allowOnlyStabilityFix, buildV1FinalLockReport };
