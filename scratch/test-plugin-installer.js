'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  plugins.pluginStore.resetStore();

  // Install valid plugin
  const manifest = { id: 'my_plugin', name: 'My Plugin', version: '1.0.0', main: 'index.js', type: 'module', description: 'A test plugin' };
  const installed = plugins.pluginInstaller.installPlugin(manifest, 'manual');
  assert(installed.ok === true, 'installPlugin succeeds');
  assert(installed.plugin.id === 'my_plugin', 'installed plugin id');
  assert(installed.plugin.enabled === true, 'installed plugin enabled by default');
  assert(installed.plugin.status === 'installed', 'installed status');
  assert(installed.plugin.source === 'manual', 'source set');

  // Duplicate install
  const dup = plugins.pluginInstaller.installPlugin(manifest);
  assert(dup.ok === false, 'duplicate install fails');
  assert(dup.error.includes('already installed'), 'duplicate error message');

  // Install with invalid manifest
  const invalid = plugins.pluginInstaller.installPlugin({ name: 'NoId' });
  assert(invalid.ok === false, 'invalid manifest fails');
  assert(invalid.errors.length > 0, 'invalid manifest has errors');

  // Uninstall
  const uninstalled = plugins.pluginInstaller.uninstallPlugin('my_plugin');
  assert(uninstalled.ok === true, 'uninstallPlugin succeeds');
  assert(plugins.pluginStore.getPlugin('my_plugin') === null, 'plugin removed after uninstall');

  const uninstallNone = plugins.pluginInstaller.uninstallPlugin('nonexistent');
  assert(uninstallNone.ok === false, 'uninstall nonexistent fails');

  // Reinstall for enable/disable tests
  plugins.pluginInstaller.installPlugin(manifest);

  // Disable
  const disabled = plugins.pluginInstaller.disablePlugin('my_plugin');
  assert(disabled.ok === true, 'disablePlugin succeeds');
  const pAfterDisable = plugins.pluginStore.getPlugin('my_plugin');
  assert(pAfterDisable.enabled === false, 'disabled plugin enabled false');
  assert(pAfterDisable.status === 'disabled', 'disabled status');

  // Enable
  const enabled = plugins.pluginInstaller.enablePlugin('my_plugin');
  assert(enabled.ok === true, 'enablePlugin succeeds');
  const pAfterEnable = plugins.pluginStore.getPlugin('my_plugin');
  assert(pAfterEnable.enabled === true, 'enabled plugin enabled true');
  assert(pAfterEnable.status === 'active', 'active status');

  // Enable/disable nonexistent
  const enableNone = plugins.pluginInstaller.enablePlugin('nobody');
  assert(enableNone.ok === false, 'enable nonexistent fails');
  const disableNone = plugins.pluginInstaller.disablePlugin('nobody');
  assert(disableNone.ok === false, 'disable nonexistent fails');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
