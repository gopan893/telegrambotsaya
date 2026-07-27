'use strict';

const store = require('./plugin-store');

const hooks = { onBeforeLoad: [], onAfterLoad: [], onBeforeUnload: [], onAfterUnload: [], onEnable: [], onDisable: [], onConfigChange: [] };

function registerHook(hookName, handler) {
  if (!hooks[hookName]) hooks[hookName] = [];
  hooks[hookName].push(handler);
}

async function runHook(hookName, pluginId, context = {}) {
  const results = [];
  for (const handler of (hooks[hookName] || [])) {
    try {
      const result = await handler(pluginId, context);
      results.push({ ok: true, result });
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  return results;
}

async function loadPlugin(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  await runHook('onBeforeLoad', pluginId, { plugin });
  plugin.status = 'loading';
  store.setPlugin(pluginId, plugin);
  await runHook('onAfterLoad', pluginId, { plugin });
  plugin.status = 'active';
  plugin.enabled = true;
  store.setPlugin(pluginId, plugin);
  return { ok: true, plugin };
}

async function unloadPlugin(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  await runHook('onBeforeUnload', pluginId, { plugin });
  plugin.status = 'unloading';
  store.setPlugin(pluginId, plugin);
  await runHook('onAfterUnload', pluginId, { plugin });
  plugin.status = 'installed';
  plugin.enabled = false;
  store.setPlugin(pluginId, plugin);
  return { ok: true };
}

function getLifecycleStatus(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return null;
  return { id: plugin.id, status: plugin.status, enabled: plugin.enabled, updatedAt: plugin.updatedAt };
}

module.exports = { registerHook, runHook, loadPlugin, unloadPlugin, getLifecycleStatus };
