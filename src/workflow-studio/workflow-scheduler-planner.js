'use strict';

const store = require('./workflow-store');
const utils = require('./workflow-utils');

function createSchedulePlan(workflowId, params) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  if (!params || !params.cron) return { ok: false, error: 'Missing cron expression' };
  const plan = {
    id: 'sched_' + Date.now().toString(36),
    workflowId,
    cron: params.cron,
    timezone: params.timezone || 'UTC',
    enabled: params.enabled !== false,
    maxRunsPerDay: params.maxRunsPerDay || 0,
    quietHours: params.quietHours || null,
    nextRunAt: null,
    lastRunAt: null,
    createdAt: new Date().toISOString()
  };
  return { ok: true, plan };
}

function validateSchedule(cron) {
  if (!cron || typeof cron !== 'string') return { valid: false, error: 'Invalid cron expression' };
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return { valid: false, error: 'Cron must have 5-6 parts' };
  return { valid: true };
}

function getNextRunTime(cron, from) {
  const validation = validateSchedule(cron);
  if (!validation.valid) return null;
  const base = from || new Date();
  return new Date(base.getTime() + 3600000);
}

function listSchedulePlans() {
  return [];
}

module.exports = { createSchedulePlan, validateSchedule, getNextRunTime, listSchedulePlans };
