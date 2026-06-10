'use strict';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const RISK_RULES = [
  { pattern: /^read_/i, level: 'low' },
  { pattern: /notification/i, level: 'low' },
  { pattern: /^execute_/i, level: 'medium' },
  { pattern: /modify|config/i, level: 'medium' },
  { pattern: /secret|token|key/i, level: 'high' },
  { pattern: /shell|exec|spawn|system/i, level: 'critical' },
  { pattern: /deploy|rollback/i, level: 'critical' },
  { pattern: /delete|remove|destroy/i, level: 'high' }
];

function classifyRisk(action) {
  if (!action || typeof action !== 'string') return { level: 'unknown', proposalRequired: true };
  for (const rule of RISK_RULES) {
    if (rule.pattern.test(action)) {
      return { level: rule.level, proposalRequired: rule.level !== 'low' };
    }
  }
  return { level: 'low', proposalRequired: false };
}

function classifyActionRisk(action) {
  return classifyRisk(action);
}

function classifyDeviceRisk(device) {
  if (!device) return { level: 'unknown', factors: [] };
  const factors = [];
  let score = 0;
  if (device.trustLevel === 'untrusted') { score += 3; factors.push('untrusted_device'); }
  if (device.trustLevel === 'restricted') { score += 1; factors.push('restricted_device'); }
  if (device.status === 'unreachable') { score += 2; factors.push('unreachable'); }
  if ((device.capabilities || []).includes('run_shell')) { score += 3; factors.push('shell_capability'); }
  if ((device.capabilities || []).includes('deploy')) { score += 3; factors.push('deploy_capability'); }
  const level = score >= 5 ? 'critical' : score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
  return { level, score, factors, proposalRequired: level !== 'low' };
}

function getRiskLevel(action) {
  return classifyRisk(action).level;
}

function requiresApproval(action) {
  return classifyRisk(action).proposalRequired;
}

function isActionBlocked(action, blockedActions) {
  if (!Array.isArray(blockedActions)) return false;
  return blockedActions.some(b => action.toLowerCase().includes(b.toLowerCase()));
}

function isActionSafe(action, safeActions) {
  if (!Array.isArray(safeActions)) return false;
  return safeActions.some(s => action.toLowerCase().includes(s.toLowerCase()));
}

module.exports = {
  classifyRisk, classifyActionRisk, classifyDeviceRisk, getRiskLevel,
  requiresApproval, isActionBlocked, isActionSafe, RISK_LEVELS, RISK_RULES
};
