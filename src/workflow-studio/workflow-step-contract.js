'use strict';

const utils = require('./workflow-utils');

const UNSAFE_PATTERNS = [
  { pattern: /\bexec\b/i, reason: 'shell_execution' },
  { pattern: /\bspawn\b/i, reason: 'shell_execution' },
  { pattern: /\bchild_process\b/i, reason: 'shell_execution' },
  { pattern: /\bsystem\b/i, reason: 'shell_execution' },
  { pattern: /\brm\s+-rf\b/i, reason: 'destructive_delete' },
  { pattern: /\bgit\s+push\b/i, reason: 'direct_push' },
  { pattern: /\bgit\s+deploy\b/i, reason: 'direct_deploy' },
  { pattern: /\bgit\s+rollback\b/i, reason: 'direct_rollback' },
  { pattern: /\bgit\s+restore\b/i, reason: 'direct_restore' },
  { pattern: /\brender\s+deploy\b/i, reason: 'direct_deploy' },
  { pattern: /\bcurl\b.*-X\s*(POST|PUT|DELETE|PATCH)/i, reason: 'external_http_write' },
  { pattern: /\bfetch\b.*method:\s*['"]?(POST|PUT|DELETE|PATCH)/i, reason: 'external_http_write' },
  { pattern: /\bTELEGRAM_TOKEN\b/i, reason: 'credential_access' },
  { pattern: /\bDATABASE_URL\b/i, reason: 'credential_access' },
  { pattern: /\bGITHUB_TOKEN\b/i, reason: 'credential_access' },
  { pattern: /\bAPI_KEY\b/i, reason: 'credential_access' },
  { pattern: /\bSECRET\b/i, reason: 'credential_access' },
  { pattern: /\bPASSWORD\b/i, reason: 'credential_access' }
];

const STEP_REQUIRED_FIELDS = {
  device_action: ['device', 'action'],
  plugin_action: ['plugin', 'action'],
  rag_search: ['query'],
  model_route: ['model'],
  external_write: ['target', 'action'],
  external_read: ['target'],
  internal_write: ['target'],
  notify: ['channel', 'message'],
  summarize: ['source'],
  analyze: ['source'],
  read: ['source']
};

function validateStep(step, index) {
  if (!step || typeof step !== 'object') {
    return { valid: false, errors: ['Step must be an object'], index: index || 0 };
  }
  const errors = [];
  if (!step.type) errors.push('Missing step type');
  else if (!utils.isValidStepType(step.type)) errors.push(`Invalid step type: ${step.type}`);
  if (!step.id) errors.push('Missing step id');
  if (utils.isBlockedStepType(step.type)) errors.push('Blocked step type is not allowed');
  const required = STEP_REQUIRED_FIELDS[step.type];
  if (required) {
    for (const field of required) {
      if (!step[field] && !(step.params && step.params[field])) {
        errors.push(`Step type '${step.type}' requires field: ${field}`);
      }
    }
  }
  return { valid: errors.length === 0, errors, index: index != null ? index : 0 };
}

function validateAllSteps(steps) {
  if (!Array.isArray(steps)) return { valid: false, errors: ['Steps must be an array'] };
  const allErrors = [];
  for (let i = 0; i < steps.length; i++) {
    const result = validateStep(steps[i], i);
    if (!result.valid) {
      allErrors.push(...result.errors.map(e => `Step ${i}: ${e}`));
    }
  }
  return { valid: allErrors.length === 0, errors: allErrors };
}

function detectUnsafeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  const findings = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepStr = JSON.stringify(step).toLowerCase();
    for (const { pattern, reason } of UNSAFE_PATTERNS) {
      if (pattern.test(stepStr)) {
        findings.push({ stepIndex: i, stepId: step.id, stepType: step.type, reason, blocked: isHardBlock(reason) });
      }
    }
  }
  return findings;
}

function isHardBlock(reason) {
  return ['shell_execution', 'destructive_delete', 'direct_push', 'direct_deploy', 'direct_rollback', 'direct_restore', 'credential_access'].includes(reason);
}

function normalizeStep(step) {
  if (!step || typeof step !== 'object') return null;
  return {
    id: step.id || utils.generateWorkflowId(step.type || 'step'),
    type: step.type || 'read',
    name: step.name || step.type || 'Unnamed Step',
    source: step.source || null,
    target: step.target || null,
    action: step.action || null,
    device: step.device || null,
    plugin: step.plugin || null,
    query: step.query || null,
    model: step.model || null,
    channel: step.channel || null,
    message: step.message || null,
    params: step.params || {},
    conditions: step.conditions || [],
    timeout: step.timeout || 30000,
    continueOnError: step.continueOnError !== undefined ? step.continueOnError : false
  };
}

function buildStepContract(steps) {
  const normalized = (steps || []).map(normalizeStep).filter(Boolean);
  const validation = validateAllSteps(normalized);
  const unsafe = detectUnsafeSteps(normalized);
  const hardBlocks = unsafe.filter(f => f.blocked);
  return {
    steps: normalized,
    valid: validation.valid,
    validationErrors: validation.errors,
    unsafeFindings: unsafe,
    hardBlocks,
    hasUnsafe: unsafe.length > 0,
    hasHardBlocks: hardBlocks.length > 0
  };
}

module.exports = {
  validateStep, validateAllSteps, detectUnsafeSteps, normalizeStep,
  buildStepContract, isHardBlock, UNSAFE_PATTERNS
};
