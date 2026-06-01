'use strict';

const metadata = require('./tool-metadata');
const toolAudit = require('./tool-audit');
const utils = require('./tool-utils');

const handlers = new Map();

async function loadRegistry(services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const value = await services.storageManager.safeRead(utils.TOOL_REGISTRY_KEY, []);
      return Array.isArray(value) ? value : [];
    }
  } catch (_) {}
  if (!services.__toolStore) services.__toolStore = {};
  if (!Array.isArray(services.__toolStore[utils.TOOL_REGISTRY_KEY])) services.__toolStore[utils.TOOL_REGISTRY_KEY] = [];
  return services.__toolStore[utils.TOOL_REGISTRY_KEY];
}

async function saveRegistry(items = [], services = {}) {
  const clean = Array.isArray(items) ? items.map(utils.sanitize) : [];
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(utils.TOOL_REGISTRY_KEY, clean);
      return clean;
    }
  } catch (_) {}
  if (!services.__toolStore) services.__toolStore = {};
  services.__toolStore[utils.TOOL_REGISTRY_KEY] = clean;
  return clean;
}

function getToolHandler(toolId) {
  return handlers.get(utils.normalizeToolId(toolId)) || null;
}

async function registerTool(tool, handler, services = {}) {
  const validation = metadata.validateToolDefinition(tool);
  if (!validation.ok) return validation;
  if (typeof handler !== 'function') return { ok: false, error: 'TOOL_HANDLER_REQUIRED' };
  const registry = await loadRegistry(services);
  const index = registry.findIndex(item => item.id === validation.tool.id);
  const nextTool = {
    ...(index >= 0 ? registry[index] : {}),
    ...validation.tool,
    createdAt: index >= 0 ? (registry[index].createdAt || validation.tool.createdAt) : validation.tool.createdAt,
    updatedAt: utils.nowIso()
  };
  if (index >= 0) registry[index] = nextTool;
  else registry.push(nextTool);
  handlers.set(nextTool.id, handler);
  await saveRegistry(registry, services);
  if (index < 0) {
    await toolAudit.recordToolAudit({
      action: 'tool/registered',
      toolId: nextTool.id,
      actionType: nextTool.actionType,
      riskLevel: nextTool.riskLevel,
      userId: services.actorId || '',
      workspaceId: services.workspaceId || '',
      summary: utils.summarizeTool(nextTool)
    }, services);
  }
  return { ok: true, tool: nextTool, created: index < 0 };
}

async function unregisterTool(toolId, services = {}) {
  const id = utils.normalizeToolId(toolId);
  const registry = await loadRegistry(services);
  const next = registry.filter(item => item.id !== id);
  handlers.delete(id);
  await saveRegistry(next, services);
  await toolAudit.recordToolAudit({ action: 'tool/unregistered', toolId: id, targetId: id }, services);
  return { ok: next.length !== registry.length };
}

async function getTool(toolId, services = {}) {
  const id = utils.normalizeToolId(toolId);
  const registry = await loadRegistry(services);
  return registry.find(item => item.id === id) || null;
}

async function listTools(filters = {}, services = {}) {
  const registry = await loadRegistry(services);
  const limit = Math.min(Number(filters.limit || 200), 500);
  return registry
    .filter(item => !filters.category || item.category === filters.category)
    .filter(item => !filters.riskLevel || item.riskLevel === filters.riskLevel)
    .filter(item => typeof filters.enabled === 'undefined' || filters.enabled === '' || item.enabled === filters.enabled || String(item.enabled) === String(filters.enabled))
    .filter(item => !filters.source || item.source === filters.source)
    .filter(item => !filters.q || `${item.id} ${item.name} ${item.description} ${item.category}`.toLowerCase().includes(String(filters.q).toLowerCase()))
    .sort((a, b) => `${a.category}:${a.id}`.localeCompare(`${b.category}:${b.id}`))
    .slice(0, limit)
    .map(utils.sanitize);
}

async function updateToolEnabled(toolId, enabled, services = {}) {
  const id = utils.normalizeToolId(toolId);
  const registry = await loadRegistry(services);
  const index = registry.findIndex(item => item.id === id);
  if (index < 0) return { ok: false, error: 'TOOL_NOT_FOUND', status: 404 };
  registry[index] = { ...registry[index], enabled: Boolean(enabled), updatedAt: utils.nowIso() };
  await saveRegistry(registry, services);
  await toolAudit.recordToolAudit({
    action: enabled ? 'tool/enabled' : 'tool/disabled',
    toolId: id,
    targetId: id,
    actionType: registry[index].actionType,
    riskLevel: registry[index].riskLevel,
    userId: services.actorId || '',
    workspaceId: services.workspaceId || '',
    summary: utils.summarizeTool(registry[index])
  }, services);
  return { ok: true, tool: registry[index] };
}

function validateToolDefinition(tool) {
  return metadata.validateToolDefinition(tool);
}

async function buildToolRegistrySummary(services = {}) {
  const tools = await listTools({}, services);
  const byCategory = tools.reduce((acc, tool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1;
    return acc;
  }, {});
  const byRisk = tools.reduce((acc, tool) => {
    acc[tool.riskLevel] = (acc[tool.riskLevel] || 0) + 1;
    return acc;
  }, {});
  return utils.sanitize({
    total: tools.length,
    enabled: tools.filter(tool => tool.enabled).length,
    disabled: tools.filter(tool => !tool.enabled).length,
    byCategory,
    byRisk
  });
}

module.exports = {
  buildToolRegistrySummary,
  enableTool: (toolId, services) => updateToolEnabled(toolId, true, services),
  disableTool: (toolId, services) => updateToolEnabled(toolId, false, services),
  getTool,
  getToolHandler,
  listTools,
  loadRegistry,
  registerTool,
  saveRegistry,
  unregisterTool,
  validateToolDefinition
};
