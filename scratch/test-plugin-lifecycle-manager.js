'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  plugins.pluginStore.resetStore();

  // Install a plugin
  plugins.pluginInstaller.installPlugin({ id: 'lifecycle_test', name: 'Lifecycle', version: '1.0.0', main: 'index.js' });

  // loadPlugin
  const loaded = await plugins.pluginLifecycleManager.loadPlugin('lifecycle_test');
  assert(loaded.ok === true, 'loadPlugin succeeds');
  const statusAfterLoad = plugins.pluginLifecycleManager.getLifecycleStatus('lifecycle_test');
  assert(statusAfterLoad.status === 'active', 'status active after load');
  assert(statusAfterLoad.enabled === true, 'enabled after load');
  assert(statusAfterLoad.id === 'lifecycle_test', 'lifecycle status id');

  // loadPlugin nonexistent
  const loadNone = await plugins.pluginLifecycleManager.loadPlugin('nobody');
  assert(loadNone.ok === false, 'loadPlugin nonexistent fails');

  // unloadPlugin
  const unloaded = await plugins.pluginLifecycleManager.unloadPlugin('lifecycle_test');
  assert(unloaded.ok === true, 'unloadPlugin succeeds');
  const statusAfterUnload = plugins.pluginLifecycleManager.getLifecycleStatus('lifecycle_test');
  assert(statusAfterUnload.status === 'installed', 'status installed after unload');
  assert(statusAfterUnload.enabled === false, 'enabled false after unload');

  // unloadPlugin nonexistent
  const unloadNone = await plugins.pluginLifecycleManager.unloadPlugin('nobody');
  assert(unloadNone.ok === false, 'unloadPlugin nonexistent fails');

  // getLifecycleStatus nonexistent
  const nullStatus = plugins.pluginLifecycleManager.getLifecycleStatus('nobody');
  assert(nullStatus === null, 'getLifecycleStatus nonexistent returns null');

  // registerHook / runHook
  const hookLog = [];
  plugins.pluginLifecycleManager.registerHook('onBeforeLoad', (id, ctx) => { hookLog.push(`before:${id}`); });
  plugins.pluginLifecycleManager.registerHook('onBeforeLoad', (id, ctx) => { hookLog.push(`before2:${id}`); });
  plugins.pluginLifecycleManager.registerHook('onAfterLoad', (id, ctx) => { hookLog.push(`after:${id}`); });

  // Run the hooks manually
  const results1 = await plugins.pluginLifecycleManager.runHook('onBeforeLoad', 'test_plugin', {});
  assert(results1.length === 2, 'runHook onBeforeLoad returns 2 results');
  assert(results1[0].ok === true, 'hook handler succeeded');
  assert(hookLog.includes('before:test_plugin'), 'hook log contains before');

  const results2 = await plugins.pluginLifecycleManager.runHook('nonexistent_hook', 'test_plugin', {});
  assert(results2.length === 0, 'unknown hook returns empty');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
