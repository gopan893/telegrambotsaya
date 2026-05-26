'use strict';

const crypto = require('crypto');
const observability = require('../agents/observability');
const auditLogger = require('./audit-logger');

const APPROVAL_TTL_MS = 10 * 60 * 1000;

function ensureGovernanceState(user) {
  if (!user.governance) {
    user.governance = {
      pendingApproval: null,
      recoverySnapshots: [],
      feedback: [],
      updatedAt: Date.now()
    };
  }
  return user.governance;
}

function createApprovalId(intent, userId) {
  return crypto
    .createHash('sha1')
    .update(`${intent}:${userId}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 8);
}

function requestApproval(traceId, userId, action = {}, botServices = {}) {
  const { ensureUser, persist } = botServices;
  const user = ensureUser(userId);
  const governance = ensureGovernanceState(user);
  const approvalId = createApprovalId(action.intent, userId);

  governance.pendingApproval = {
    id: approvalId,
    intent: action.intent,
    params: action.params || {},
    originalUserMessage: action.userMessage || '',
    risk: action.risk || {},
    policy: action.policy || {},
    createdAt: Date.now(),
    expiresAt: Date.now() + APPROVAL_TTL_MS
  };
  governance.updatedAt = Date.now();

  if (typeof persist === 'function') persist();

  auditLogger.logDecision(traceId, {
    userId,
    intent: action.intent,
    decision: 'APPROVAL_REQUIRED',
    executionAllowed: false,
    risk: action.risk,
    policy: action.policy,
    violations: ['APPROVAL_REQUIRED'],
    approvalId
  });

  observability.logEvent(traceId, 'ActionApprovalLayer', 'APPROVAL_REQUEST_CREATED', {
    userId: String(userId),
    intent: action.intent,
    approvalId
  });

  return approvalId;
}

function consumeApprovedAction(traceId, userId, userMessage, botServices = {}) {
  const { ensureUser, persist } = botServices;
  const user = ensureUser(userId);
  const governance = ensureGovernanceState(user);
  const pending = governance.pendingApproval;
  const text = String(userMessage || '').toLowerCase().trim();

  if (!pending) return { approved: false };

  if (Date.now() > pending.expiresAt) {
    governance.pendingApproval = null;
    if (typeof persist === 'function') persist();
    observability.logEvent(traceId, 'ActionApprovalLayer', 'APPROVAL_EXPIRED', {
      userId: String(userId),
      intent: pending.intent
    });
    return { approved: false, expired: true };
  }

  const accepted = text === `konfirmasi ${pending.id}` ||
    text === `confirm ${pending.id}` ||
    text === `setuju ${pending.id}` ||
    text === `lanjutkan ${pending.id}`;

  const denied = text === `batal ${pending.id}` ||
    text === `cancel ${pending.id}` ||
    text === `tolak ${pending.id}`;

  if (denied) {
    governance.pendingApproval = null;
    if (typeof persist === 'function') persist();
    observability.logEvent(traceId, 'ActionApprovalLayer', 'APPROVAL_DENIED', {
      userId: String(userId),
      approvalId: pending.id
    });
    return { approved: false, denied: true };
  }

  if (!accepted) return { approved: false };

  governance.pendingApproval = null;
  governance.updatedAt = Date.now();
  if (typeof persist === 'function') persist();

  observability.logEvent(traceId, 'ActionApprovalLayer', 'APPROVAL_CONSUMED', {
    userId: String(userId),
    intent: pending.intent,
    approvalId: pending.id
  });

  return {
    approved: true,
    approvalId: pending.id,
    intent: pending.intent,
    params: pending.params || {},
    originalUserMessage: pending.originalUserMessage || userMessage,
    risk: pending.risk,
    policy: pending.policy
  };
}

module.exports = {
  requestApproval,
  consumeApprovedAction,
  ensureGovernanceState,
  APPROVAL_TTL_MS
};
