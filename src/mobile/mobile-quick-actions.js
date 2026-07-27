'use strict';

const { createId, sanitizeMobileData } = require('./mobile-utils');

const DEFAULT_ACTIONS = [
  { id: 'open_health', label: 'Health Check', tab: 'monitoring', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_telegram_control', label: 'Telegram Control', tab: 'telegram-control', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_pending_approvals', label: 'Pending Approvals', tab: 'executor', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_security_score', label: 'Security Score', tab: 'security', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_privacy_report', label: 'Privacy Report', tab: 'privacy', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_reliability_slo', label: 'Reliability SLO', tab: 'reliability', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_knowledge_search', label: 'Knowledge Search', tab: 'rag-kb', riskLevel: 'read', actionType: 'navigate' },
  { id: 'open_recipes', label: 'Recipes', tab: 'recipes', riskLevel: 'read', actionType: 'navigate' },
  { id: 'safe_dashboard_refresh', label: 'Refresh Dashboard', actionType: 'refresh', riskLevel: 'read' },
  { id: 'create_support_snapshot', label: 'Support Snapshot', actionType: 'snapshot', riskLevel: 'read' }
];

const DANGEROUS_KEYWORDS = ['deploy', 'rollback', 'push', 'release', 'send_email', 'mutate_calendar', 'hard_delete'];

function listMobileQuickActions(actor, services) {
  return DEFAULT_ACTIONS.map(a => sanitizeMobileData(a));
}

function getQuickAction(actionId) {
  const action = DEFAULT_ACTIONS.find(a => a.id === actionId);
  return action || null;
}

function validateQuickAction(action) {
  const errors = [];
  if (!action) return { valid: false, errors: ['Action is required'] };
  if (!action.id) errors.push('id is required');
  if (!action.riskLevel) errors.push('riskLevel is required');
  if (!['read', 'write', 'external', 'danger'].includes(action.riskLevel)) {
    errors.push('riskLevel must be read/write/external/danger');
  }
  if (!action.actionType) errors.push('actionType is required');
  if (action.actionType === 'navigate' && !action.tab) {
    errors.push('navigate action must have a tab');
  }
  if (DANGEROUS_KEYWORDS.some(k => action.actionType && action.actionType.includes(k))) {
    errors.push('Dangerous actionType not allowed in quick actions');
  }
  return { valid: errors.length === 0, errors };
}

function simulateQuickAction(actionId, actor, services) {
  const action = getQuickAction(actionId);
  if (!action) return { ok: false, error: 'Action not found' };
  if (['write', 'external', 'danger'].includes(action.riskLevel)) {
    return { ok: false, requiresProposal: true, message: 'This action requires proposal approval' };
  }
  return { ok: true, action: sanitizeMobileData(action), simulated: true };
}

function executeSafeQuickAction(actionId, actor, services) {
  const action = getQuickAction(actionId);
  if (!action) return { ok: false, error: 'Action not found' };
  if (['write', 'external', 'danger'].includes(action.riskLevel)) {
    return { ok: false, requiresProposal: true, message: 'This action requires proposal approval' };
  }
  return { ok: true, action: sanitizeMobileData(action), executed: true };
}

module.exports = {
  listMobileQuickActions,
  getQuickAction,
  validateQuickAction,
  simulateQuickAction,
  executeSafeQuickAction,
  DEFAULT_ACTIONS
};
