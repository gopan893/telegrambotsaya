'use strict';

const store = require('./local-node-store');

const BLOCKED_ACTIONS = ['shell', 'exec', 'spawn', 'child_process', 'eval', 'Function', 'sudo', 'rm -rf'];
const SAFE_ACTIONS = ['read_state', 'send_notification', 'heartbeat', 'health_check', 'capability_report'];

function isActionWithinBoundary(action, nodeType) {
  if (!action || typeof action !== 'string') return { allowed: false, reason: 'invalid_action' };
  const lower = action.toLowerCase();
  for (const blocked of BLOCKED_ACTIONS) {
    if (lower.includes(blocked.toLowerCase())) {
      return { allowed: false, reason: 'blocked_action', detail: blocked };
    }
  }
  for (const safe of SAFE_ACTIONS) {
    if (lower.includes(safe.toLowerCase())) {
      return { allowed: true, reason: 'safe_action' };
    }
  }
  return { allowed: true, reason: 'not_blocked' };
}

function validateNodeAction(action, nodeType) {
  return isActionWithinBoundary(action, nodeType);
}

function getBlockedActions() {
  return [...BLOCKED_ACTIONS];
}

function getSafeActions() {
  return [...SAFE_ACTIONS];
}

function checkBoundaryViolation(action, nodeType) {
  const result = isActionWithinBoundary(action, nodeType);
  return { violation: !result.allowed, ...result };
}

module.exports = {
  isActionWithinBoundary, validateNodeAction, getBlockedActions,
  getSafeActions, checkBoundaryViolation, BLOCKED_ACTIONS, SAFE_ACTIONS
};
