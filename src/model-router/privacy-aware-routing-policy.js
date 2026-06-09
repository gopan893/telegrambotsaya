'use strict';

const taskClassifier = require('./task-model-classifier');

function evaluateModelPrivacyPolicy(task = {}, context = {}, services = {}) {
  const isPrivate = task.class === 'private_lifeos' || task.sensitivity === 'high' || /life.?os|mood|energy|private/i.test(String(task.input || ''));
  return {
    isPrivate,
    cloudAllowed: !isPrivate && context.privacyMode !== 'strict',
    localPreferred: isPrivate || context.privacyMode === 'local_preferred',
    redactionNeeded: !isPrivate && /secret|token|api.?key|password|credential/i.test(String(task.input || ''))
  };
}

function canUseCloudModel(task = {}, context = {}, services = {}) {
  const policy = evaluateModelPrivacyPolicy(task, context, services);
  if (policy.isPrivate) return { allowed: false, reason: 'Private data cannot use cloud model without explicit approval.' };
  if (context.privacyMode === 'local_only') return { allowed: false, reason: 'Privacy mode set to local only.' };
  if (!policy.redactionNeeded) return { allowed: true, reason: 'No privacy concern.' };
  return { allowed: true, reason: 'Redaction needed but cloud allowed with redaction.' };
}

function shouldPreferLocalModel(task = {}, context = {}, services = {}) {
  const policy = evaluateModelPrivacyPolicy(task, context, services);
  if (policy.isPrivate) return true;
  if (context.privacyMode === 'local_preferred' || context.privacyMode === 'local_only') return true;
  if (task.class === 'simple_chat' || task.class === 'routing_classification') return true;
  return false;
}

function redactModelInputForCloud(input = '', context = {}, services = {}) {
  let text = String(input);
  const secrets = services.secretGuard || null;
  if (secrets?.sanitize) return secrets.sanitize(text);
  const patterns = [
    /TELEGRAM_TOKEN|DATABASE_URL|REDIS_URL|GITHUB_TOKEN|API_KEY|SECRET|PASSWORD|Bearer\s+\S+/gi,
    /sk-[A-Za-z0-9_-]{3,}/g, /ghp_[A-Za-z0-9_]{3,}/g, /github_pat_[A-Za-z0-9_]{3,}/g
  ];
  for (const p of patterns) text = text.replace(p, '[REDACTED]');
  return text;
}

function blockUnsafeModelRouting(task = {}, context = {}, services = {}) {
  const policy = evaluateModelPrivacyPolicy(task, context, services);
  if (policy.isPrivate && context.privacyMode !== 'owner_allowed') {
    return { blocked: true, reason: 'Private Life OS data blocked from model routing. Owner approval required.' };
  }
  return { blocked: false, reason: '' };
}

module.exports = { evaluateModelPrivacyPolicy, canUseCloudModel, shouldPreferLocalModel, redactModelInputForCloud, blockUnsafeModelRouting };
