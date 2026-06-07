'use strict';

const store = require('./operating-loop-store');

const VALID_MODES = ['manual', 'scheduled_readonly', 'scheduled_dry_run', 'proposal_only'];
const VALID_STATUSES = ['enabled', 'disabled', 'paused'];
const DANGEROUS_DEFAULTS = [
  'write', 'external', 'danger', 'shell', 'git_push',
  'deploy', 'rollback', 'email_send', 'calendar_write', 'webhook_post'
];

function validateOperatingLoopConfig(loopDef, services) {
  if (services === undefined) services = {};
  const errors = [];

  if (!loopDef || typeof loopDef !== 'object') {
    return { ok: false, errors: ['loopDef must be a non-null object'] };
  }

  if (!loopDef.id || typeof loopDef.id !== 'string' || !loopDef.id.trim()) {
    errors.push('id is required and must be a non-empty string');
  }

  if (loopDef.mode && !VALID_MODES.includes(loopDef.mode)) {
    errors.push(`mode must be one of: ${VALID_MODES.join(', ')}`);
  }

  if (loopDef.status && !VALID_STATUSES.includes(loopDef.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (loopDef.autoApprove === true) {
    errors.push('autoApprove cannot be set to true');
  }

  if (loopDef.autoRun === true) {
    errors.push('autoRun cannot be set to true');
  }

  if (!loopDef.blockedActions || !Array.isArray(loopDef.blockedActions) || loopDef.blockedActions.length === 0) {
    errors.push('blockedActions must include dangerous defaults');
  } else {
    const missing = DANGEROUS_DEFAULTS.filter(a => !loopDef.blockedActions.includes(a));
    if (missing.length > 0) {
      errors.push(`blockedActions must include: ${missing.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: loopDef };
}

async function registerOperatingLoop(loopDef, services) {
  if (services === undefined) services = {};
  try {
    const validation = validateOperatingLoopConfig(loopDef, services);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors };
    }
    const existing = await store.getOperatingLoop(loopDef.id, services);
    if (existing.ok && existing.data) {
      return { ok: false, errors: [`Loop "${loopDef.id}" is already registered`] };
    }
    const result = await store.saveOperatingLoop(loopDef, services);
    return result;
  } catch (err) {
    console.error('[operating-loop-registry] registerOperatingLoop error:', err.message);
    return { ok: false, errors: [err.message] };
  }
}

async function getOperatingLoop(loopId, services) {
  if (services === undefined) services = {};
  try {
    return await store.getOperatingLoop(loopId, services);
  } catch (err) {
    console.error('[operating-loop-registry] getOperatingLoop error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function listOperatingLoops(filters, services) {
  if (services === undefined) services = {};
  if (filters === undefined) filters = {};
  try {
    return await store.listOperatingLoops(filters, services);
  } catch (err) {
    console.error('[operating-loop-registry] listOperatingLoops error:', err.message);
    return { ok: false, error: err.message, data: [], total: 0 };
  }
}

async function enableOperatingLoop(loopId, services) {
  if (services === undefined) services = {};
  try {
    const existing = await store.getOperatingLoop(loopId, services);
    if (!existing.ok || !existing.data) {
      return { ok: false, error: 'LOOP_NOT_FOUND' };
    }
    const updated = await store.saveOperatingLoop({ id: loopId, status: 'enabled' }, services);
    return updated;
  } catch (err) {
    console.error('[operating-loop-registry] enableOperatingLoop error:', err.message);
    return { ok: false, error: err.message };
  }
}

async function disableOperatingLoop(loopId, services) {
  if (services === undefined) services = {};
  try {
    const existing = await store.getOperatingLoop(loopId, services);
    if (!existing.ok || !existing.data) {
      return { ok: false, error: 'LOOP_NOT_FOUND' };
    }
    const updated = await store.saveOperatingLoop({ id: loopId, status: 'disabled' }, services);
    return updated;
  } catch (err) {
    console.error('[operating-loop-registry] disableOperatingLoop error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  registerOperatingLoop,
  getOperatingLoop,
  listOperatingLoops,
  enableOperatingLoop,
  disableOperatingLoop,
  validateOperatingLoopConfig
};
