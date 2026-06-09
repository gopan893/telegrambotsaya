'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  plugins.pluginStore.resetStore();

  // Set and get plugins
  const p1 = plugins.pluginStore.setPlugin('plugin_alpha', { name: 'Alpha', type: 'module', enabled: true });
  assert(p1 && p1.id === 'plugin_alpha', 'setPlugin returns plugin_alpha');
  const p2 = plugins.pluginStore.setPlugin('plugin_beta', { name: 'Beta', type: 'hook', enabled: false });
  assert(p2 && p2.id === 'plugin_beta', 'setPlugin returns plugin_beta');

  const got1 = plugins.pluginStore.getPlugin('plugin_alpha');
  assert(got1 && got1.name === 'Alpha', 'getPlugin returns Alpha');

  const got2 = plugins.pluginStore.getPlugin('nonexistent');
  assert(got2 === null, 'getPlugin nonexistent returns null');

  // List plugins
  const all = plugins.pluginStore.listPlugins();
  assert(all.length === 2, 'listPlugins returns 2 plugins');

  const modules = plugins.pluginStore.listPlugins({ type: 'module' });
  assert(modules.length === 1, 'listPlugins filter type module');

  const enabled = plugins.pluginStore.listPlugins({ enabled: true });
  assert(enabled.length === 1, 'listPlugins filter enabled');

  // Remove plugin
  const removed = plugins.pluginStore.removePlugin('plugin_alpha');
  assert(removed === true, 'removePlugin returns true');
  assert(plugins.pluginStore.getPlugin('plugin_alpha') === null, 'removed plugin gone');

  // Set and get connectors
  const c1 = plugins.pluginStore.setConnector('conn_http', { type: 'webhook', status: 'connected', connected: true });
  assert(c1 && c1.id === 'conn_http', 'setConnector returns conn_http');
  const c2 = plugins.pluginStore.setConnector('conn_slack', { type: 'api', status: 'disconnected', connected: false });
  assert(c2 && c2.id === 'conn_slack', 'setConnector returns conn_slack');

  const gotC1 = plugins.pluginStore.getConnector('conn_http');
  assert(gotC1 && gotC1.type === 'webhook', 'getConnector returns webhook type');

  // List connectors
  const conns = plugins.pluginStore.listConnectors();
  assert(conns.length === 2, 'listConnectors returns 2');

  const connectedConns = plugins.pluginStore.listConnectors({ connected: true });
  assert(connectedConns.length === 1, 'listConnectors filter connected');

  // Remove connector
  assert(plugins.pluginStore.removeConnector('conn_slack') === true, 'removeConnector');
  assert(plugins.pluginStore.listConnectors().length === 1, 'connector count after remove');

  // GetStats
  plugins.pluginStore.setPlugin('stats_test', { name: 'Stats', type: 'module', enabled: true });
  const stats = plugins.pluginStore.getStats();
  assert(stats.pluginCount === 2, 'stats pluginCount');
  assert(stats.connectorCount === 1, 'stats connectorCount');

  // Reset store
  plugins.pluginStore.resetStore();
  assert(plugins.pluginStore.listPlugins().length === 0, 'resetStore clears plugins');
  assert(plugins.pluginStore.listConnectors().length === 0, 'resetStore clears connectors');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
