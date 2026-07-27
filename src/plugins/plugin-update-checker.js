'use strict';

const store = require('./plugin-store');
const marketplace = require('./plugin-marketplace-client');

async function checkForUpdates(pluginId) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  const remote = await marketplace.getMarketplacePlugin(pluginId);
  if (!remote) return { ok: true, current: plugin.version, updateAvailable: false };
  const hasUpdate = remote.version !== plugin.version;
  return { ok: true, pluginId, currentVersion: plugin.version, latestVersion: remote.version, updateAvailable: hasUpdate };
}

async function checkAllUpdates() {
  const plugins = store.listPlugins();
  const results = [];
  for (const p of plugins) {
    const check = await checkForUpdates(p.id);
    results.push(check);
  }
  return { total: results.length, updatesAvailable: results.filter(r => r.updateAvailable).length, results };
}

module.exports = { checkForUpdates, checkAllUpdates };
