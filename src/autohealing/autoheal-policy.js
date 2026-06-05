'use strict';

const WRITE_OR_EXTERNAL_CATEGORIES = new Set([
  'code',
  'deploy',
  'github',
  'cicd_write',
  'database',
  'restore',
  'permission',
  'external'
]);

function classifyAutoHealLevel(action) {
  if (!action) return 'L3';
  if (action.level && ['L0','L1','L2','L3'].includes(action.level)) return action.level;
  if (action.requiresApproval || action.requiresEvaluation) return 'L2';
  if (WRITE_OR_EXTERNAL_CATEGORIES.has(action.category)) return 'L2';
  return 'L1';
}

function requireProposalForAutoHeal(action) {
  return classifyAutoHealLevel(action) === 'L2' || Boolean(action?.requiresApproval || action?.requiresEvaluation);
}

function requireEvaluationForAutoHeal(action) {
  return Boolean(action?.requiresEvaluation || classifyAutoHealLevel(action) === 'L2');
}

function blockUnsafeAutoHeal(action) {
  const level = classifyAutoHealLevel(action);
  if (level === 'L3') return { blocked: true, reason: 'L3 blocked' };
  const handler = String(action?.handlerName || '').toLowerCase();
  const unsafe = [
    'shell',
    'exec',
    'spawn',
    'gitpush',
    'gitcommit',
    'workflowdispatchdirect',
    'deploydirect',
    'restorebackupdirect',
    'harddelete'
  ];
  if (unsafe.some(pattern => handler.includes(pattern))) {
    return { blocked: true, reason: 'unsafe handler blocked' };
  }
  if (WRITE_OR_EXTERNAL_CATEGORIES.has(action?.category) && level === 'L1') {
    return { blocked: true, reason: 'write/external action cannot be L1' };
  }
  return { blocked: false };
}

function enforceAutoHealCooldown(action, recentRuns) {
  if (!action.cooldownSeconds || !recentRuns || recentRuns.length === 0) return { ok: true };
  const last = recentRuns[recentRuns.length - 1];
  const date = last.completedAt || last.startedAt || last.createdAt;
  const elapsed = (Date.now() - new Date(date).getTime()) / 1000;
  if (elapsed < action.cooldownSeconds) return { ok: false, reason: 'cooldown', remaining: Math.ceil(action.cooldownSeconds - elapsed) };
  return { ok: true };
}

function enforceAutoHealRateLimit(action, todayRuns) {
  if (!action.maxRunsPerDay || !todayRuns) return { ok: true };
  if (todayRuns.length >= action.maxRunsPerDay) return { ok: false, reason: 'rate_limit', max: action.maxRunsPerDay };
  return { ok: true };
}

function canRunAutoHeal(action, ctx = {}, services = {}) {
  if (!action || !action.enabled) return { ok: false, reason: 'disabled' };
  const unsafe = blockUnsafeAutoHeal(action);
  if (unsafe.blocked) return { ok: false, reason: unsafe.reason, blocked: true };
  const level = classifyAutoHealLevel(action);
  if (level === 'L0') return { ok: false, reason: 'L0 observe only', observeOnly: true };
  if (level === 'L3') return { ok: false, reason: 'L3 blocked', blocked: true };
  if (level === 'L2') return { ok: false, reason: 'L2 requires proposal', proposalRequired: true, evaluationRequired: requireEvaluationForAutoHeal(action) };
  return { ok: true, level: 'L1', proposalRequired: false, evaluationRequired: false };
}

module.exports = {
  canRunAutoHeal,
  classifyAutoHealLevel,
  requireProposalForAutoHeal,
  requireEvaluationForAutoHeal,
  blockUnsafeAutoHeal,
  enforceAutoHealCooldown,
  enforceAutoHealRateLimit,
  classifyLevel: classifyAutoHealLevel,
  requireProposal: requireProposalForAutoHeal,
  requireEvaluation: requireEvaluationForAutoHeal,
  blockUnsafe: action => blockUnsafeAutoHeal(action).blocked,
  enforceCooldown: enforceAutoHealCooldown,
  enforceRateLimit: enforceAutoHealRateLimit
};
