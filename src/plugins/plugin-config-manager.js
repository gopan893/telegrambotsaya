'use strict';

const store = require('./plugin-store');

function getPluginConfig(pluginId) {
  const plugin = store.getPlugin(pluginId);
  return plugin ? { ...(plugin.config || {}) } : null;
}

function setPluginConfig(pluginId, config = {}) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  plugin.config = { ...(plugin.config || {}), ...config };
  plugin.updatedAt = new Date().toISOString();
  store.setPlugin(pluginId, plugin);
  return { ok: true, config: plugin.config };
}

function mergePluginConfig(pluginId, partialConfig) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  plugin.config = { ...(plugin.config || {}), ...partialConfig };
  plugin.updatedAt = new Date().toISOString();
  store.setPlugin(pluginId, plugin);
  return { ok: true, config: plugin.config };
}

function resetPluginConfig(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  plugin.config = {};
  plugin.updatedAt = new Date().toISOString();
  store.setPlugin(pluginId, plugin);
  return { ok: true };
}

function validateConfigSchema(config, schema) {
  const errors = [];
  for (const [key, rules] of Object.entries(schema || {})) {
    const value = config[key];
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`Missing required config key: ${key}`);
    }
    if (value !== undefined && rules.type && typeof value !== rules.type) {
      errors.push(`Config "${key}" should be ${rules.type}, got ${typeof value}`);
    }
    if (value !== undefined && rules.enum && !rules.enum.includes(value)) {
      errors.push(`Config "${key}" must be one of: ${rules.enum.join(', ')}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { getPluginConfig, setPluginConfig, mergePluginConfig, resetPluginConfig, validateConfigSchema };
