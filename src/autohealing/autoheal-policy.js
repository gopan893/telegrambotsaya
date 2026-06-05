'use strict';

function canRunAutoHeal(action, ctx) {
  if (!action || !action.enabled) return { ok: false, reason: 'disabled' };
  if (action.level === 'L0') return { ok: false, reason: 'L0 observe only' };
  if (action.level === 'L3') return { ok: false, reason: 'L3 blocked' };
  if (action.level === 'L2') return { ok: false, reason: 'L2 requires proposal', proposalRequired: true };
  return { ok: true, level: 'L1' };
}

function classifyLevel(action) {
  if (!action) return 'L3';
  if (action.level && ['L0','L1','L2','L3'].includes(action.level)) return action.level;
  if (action.requiresApproval || action.requiresEvaluation) return 'L2';
  return 'L1';
}

function requireProposal(action) {
  return action.level === 'L2' || action.requiresApproval || action.requiresEvaluation;
}

function requireEvaluation(action) {
  return action.requiresEvaluation || action.level === 'L2';
}

function blockUnsafe(action) {
  return action.level === 'L3' || (action.category === 'code' && action.level !== 'L1');
}

function enforceCooldown(action, recentRuns) {
  if (!action.cooldownSeconds || !recentRuns || recentRuns.length === 0) return { ok: true };
  const last = recentRuns[recentRuns.length - 1];
  const elapsed = (Date.now() - new Date(last.createdAt).getTime()) / 1000;
  if (elapsed < action.cooldownSeconds) return { ok: false, reason: 'cooldown', remaining: Math.ceil(action.cooldownSeconds - elapsed) };
  return { ok: true };
}

function enforceRateLimit(action, todayRuns) {
  if (!action.maxRunsPerDay || !todayRuns) return { ok: true };
  if (todayRuns.length >= action.maxRunsPerDay) return { ok: false, reason: 'rate_limit', max: action.maxRunsPerDay };
  return { ok: true };
}

module.exports = { canRunAutoHeal, classifyLevel, requireProposal, requireEvaluation, blockUnsafe, enforceCooldown, enforceRateLimit };
