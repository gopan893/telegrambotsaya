'use strict';

const auditLog = require('../dashboard/audit-log');
const utils = require('./tool-utils');

async function readList(key, services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const value = await services.storageManager.safeRead(key, []);
      return Array.isArray(value) ? value : [];
    }
  } catch (_) {}
  if (!services.__toolStore) services.__toolStore = {};
  if (!Array.isArray(services.__toolStore[key])) services.__toolStore[key] = [];
  return services.__toolStore[key];
}

async function writeList(key, list = [], services = {}, limit = 1000) {
  const clean = Array.isArray(list) ? list.slice(-limit) : [];
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, clean);
      return clean;
    }
  } catch (_) {}
  if (!services.__toolStore) services.__toolStore = {};
  services.__toolStore[key] = clean;
  return clean;
}

async function recordToolAudit(entry = {}, services = {}) {
  const audit = utils.sanitize({
    id: entry.id || utils.createId('tool_audit'),
    actorType: entry.actorType || services.actorType || 'tool',
    actorId: entry.actorId || services.actorId || entry.userId || '',
    action: entry.action || 'tool/unknown',
    targetType: entry.targetType || 'tool',
    targetId: entry.targetId || entry.toolId || '',
    toolId: entry.toolId || '',
    actionType: entry.actionType || '',
    riskLevel: entry.riskLevel || 'low',
    userId: entry.userId || '',
    workspaceId: entry.workspaceId || '',
    actorRole: entry.actorRole || '',
    permission: entry.permission || '',
    decision: entry.decision || 'allowed',
    status: entry.status || 'ok',
    summary: entry.summary || entry.afterSummary || {},
    reason: utils.compactText(entry.reason || '', 240),
    createdAt: entry.createdAt || utils.nowIso()
  });
  const list = await readList(utils.TOOL_AUDIT_KEY, services);
  list.push(audit);
  await writeList(utils.TOOL_AUDIT_KEY, list, services);
  try {
    await auditLog.recordAuditLog({
      actorType: audit.actorType,
      actorId: audit.actorId,
      action: audit.action,
      targetType: audit.targetType,
      targetId: audit.targetId,
      userId: audit.userId,
      workspaceId: audit.workspaceId,
      actorRole: audit.actorRole,
      permission: audit.permission,
      decision: audit.decision,
      status: audit.status,
      afterSummary: audit.summary,
      reason: audit.reason
    }, services);
  } catch (_) {}
  return audit;
}

async function listToolAudit(filters = {}, services = {}) {
  const list = await readList(utils.TOOL_AUDIT_KEY, services);
  const limit = Math.min(Number(filters.limit || 50), 100);
  return list
    .filter(item => !filters.toolId || item.toolId === filters.toolId)
    .filter(item => !filters.workspaceId || item.workspaceId === filters.workspaceId)
    .filter(item => !filters.action || item.action === filters.action)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map(utils.sanitize);
}

async function recordToolRun(run = {}, services = {}) {
  const value = utils.sanitize({
    id: run.id || utils.createId('tool_run'),
    toolId: run.toolId,
    actionType: run.actionType || run.toolId,
    userId: run.userId || '',
    workspaceId: run.workspaceId || '',
    status: run.status || (run.success ? 'ok' : 'failed'),
    success: Boolean(run.success),
    latencyMs: Number(run.latencyMs || 0),
    riskLevel: run.riskLevel || 'low',
    requiresApproval: Boolean(run.requiresApproval),
    resultSummary: utils.compactText(run.resultSummary || '', 500),
    error: utils.compactText(run.error || '', 300),
    createdAt: run.createdAt || utils.nowIso()
  });
  const list = await readList(utils.TOOL_RUNS_KEY, services);
  list.push(value);
  await writeList(utils.TOOL_RUNS_KEY, list, services);
  return value;
}

async function listToolRuns(filters = {}, services = {}) {
  const list = await readList(utils.TOOL_RUNS_KEY, services);
  const limit = Math.min(Number(filters.limit || 50), 100);
  return list
    .filter(item => !filters.toolId || item.toolId === filters.toolId)
    .filter(item => !filters.workspaceId || item.workspaceId === filters.workspaceId)
    .filter(item => !filters.status || item.status === filters.status)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map(utils.sanitize);
}

module.exports = {
  listToolAudit,
  listToolRuns,
  recordToolAudit,
  recordToolRun
};
