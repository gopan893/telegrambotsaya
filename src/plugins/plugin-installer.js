'use strict';

const store = require('./plugin-store');
const validator = require('./plugin-validator');

function installPlugin(manifest, source = 'manual') {
  const validation = validator.validatePluginManifest(manifest);
  if (!validation.valid) return { ok: false, errors: validation.errors };
  if (store.getPlugin(manifest.id)) return { ok: false, error: `Plugin "${manifest.id}" already installed` };
  const plugin = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    main: manifest.main,
    type: manifest.type || 'module',
    description: manifest.description || '',
    author: manifest.author || '',
    dependencies: manifest.dependencies || [],
    permissions: manifest.permissions || [],
    config: manifest.config || {},
    enabled: true,
    status: 'installed',
    source,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.setPlugin(manifest.id, plugin);
  return { ok: true, plugin };
}

function uninstallPlugin(pluginId) {
  if (!store.getPlugin(pluginId)) return { ok: false, error: `Plugin "${pluginId}" not found` };
  store.removePlugin(pluginId);
  return { ok: true };
}

function enablePlugin(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  plugin.enabled = true;
  plugin.status = 'active';
  store.setPlugin(pluginId, plugin);
  return { ok: true, plugin };
}

function disablePlugin(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  plugin.enabled = false;
  plugin.status = 'disabled';
  store.setPlugin(pluginId, plugin);
  return { ok: true, plugin };
}

module.exports = { installPlugin, uninstallPlugin, enablePlugin, disablePlugin };
