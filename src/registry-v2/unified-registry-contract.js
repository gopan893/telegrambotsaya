'use strict';

const VALID_TYPES = [
  'dashboard_tab',
  'dashboard_api',
  'telegram_command',
  'capability',
  'alias'
];

const VALID_STATUSES = ['active', 'inactive', 'deprecated', 'pending'];
const VALID_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

function createUnifiedItem(data) {
  const now = new Date().toISOString();
  return {
    id: data.id || '',
    type: data.type || 'capability',
    module: data.module || '',
    title: data.title || '',
    description: data.description || '',
    path: data.path || '',
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    visibility: data.visibility || 'internal',
    riskLevel: data.riskLevel || 'low',
    requiresAuth: data.requiresAuth !== undefined ? data.requiresAuth : true,
    requiresApproval: data.requiresApproval !== undefined ? data.requiresApproval : false,
    requiresEvaluation: data.requiresEvaluation !== undefined ? data.requiresEvaluation : false,
    enabled: data.enabled !== undefined ? data.enabled : true,
    status: data.status || 'active',
    ownerModule: data.ownerModule || '',
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

function validateUnifiedItem(item) {
  const errors = [];
  if (!item.id || typeof item.id !== 'string') errors.push('id is required and must be a string');
  if (!VALID_TYPES.includes(item.type)) errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  if (item.status && !VALID_STATUSES.includes(item.status)) errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  if (item.riskLevel && !VALID_RISK_LEVELS.includes(item.riskLevel)) errors.push(`riskLevel must be one of: ${VALID_RISK_LEVELS.join(', ')}`);
  return errors;
}

function isUnifiedItemValid(item) {
  return validateUnifiedItem(item).length === 0;
}

module.exports = {
  createUnifiedItem,
  validateUnifiedItem,
  isUnifiedItemValid,
  VALID_TYPES,
  VALID_STATUSES,
  VALID_RISK_LEVELS
};
