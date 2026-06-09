'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  plugins.pluginStore.resetStore();

  // Install a plugin with config
  plugins.pluginInstaller.installPlugin({
    id: 'cfg_test',
    name: 'Config Test',
    version: '1.0.0',
    main: 'index.js',
    config: { theme: 'dark', polling: true }
  });

  // getPluginConfig
  const config1 = plugins.pluginConfigManager.getPluginConfig('cfg_test');
  assert(config1 !== null, 'getPluginConfig returns object');
  assert(config1.theme === 'dark', 'initial config theme dark');
  assert(config1.polling === true, 'initial config polling true');

  // getPluginConfig nonexistent
  const nullConfig = plugins.pluginConfigManager.getPluginConfig('nobody');
  assert(nullConfig === null, 'getPluginConfig nonexistent returns null');

  // setPluginConfig
  const setResult = plugins.pluginConfigManager.setPluginConfig('cfg_test', { theme: 'light', timeout: 5000 });
  assert(setResult.ok === true, 'setPluginConfig ok');
  assert(setResult.config.theme === 'light', 'config updated theme light');
  assert(setResult.config.timeout === 5000, 'config updated timeout');

  // setPluginConfig nonexistent
  const setNone = plugins.pluginConfigManager.setPluginConfig('nobody', {});
  assert(setNone.ok === false, 'setPluginConfig nonexistent fails');

  // mergePluginConfig
  const mergeResult = plugins.pluginConfigManager.mergePluginConfig('cfg_test', { retries: 3 });
  assert(mergeResult.ok === true, 'mergePluginConfig ok');
  assert(mergeResult.config.retries === 3, 'merged retries');
  assert(mergeResult.config.theme === 'light', 'existing config preserved');

  // mergePluginConfig nonexistent
  const mergeNone = plugins.pluginConfigManager.mergePluginConfig('nobody', {});
  assert(mergeNone.ok === false, 'mergePluginConfig nonexistent fails');

  // resetPluginConfig
  const resetResult = plugins.pluginConfigManager.resetPluginConfig('cfg_test');
  assert(resetResult.ok === true, 'resetPluginConfig ok');
  const afterReset = plugins.pluginConfigManager.getPluginConfig('cfg_test');
  assert(Object.keys(afterReset).length === 0, 'config empty after reset');

  // resetPluginConfig nonexistent
  const resetNone = plugins.pluginConfigManager.resetPluginConfig('nobody');
  assert(resetNone.ok === false, 'resetPluginConfig nonexistent fails');

  // validateConfigSchema
  const schema = { apiKey: { required: true, type: 'string' }, timeout: { type: 'number' }, mode: { enum: ['fast', 'safe'] } };
  const valid = plugins.pluginConfigManager.validateConfigSchema({ apiKey: 'abc', timeout: 30, mode: 'fast' }, schema);
  assert(valid.valid === true, 'valid schema passes');

  const invalid1 = plugins.pluginConfigManager.validateConfigSchema({ timeout: 'bad' }, schema);
  assert(invalid1.valid === false, 'wrong type fails');

  const invalid2 = plugins.pluginConfigManager.validateConfigSchema({ mode: 'unsupported' }, schema);
  assert(invalid2.valid === false, 'invalid enum fails');

  const invalid3 = plugins.pluginConfigManager.validateConfigSchema({}, schema);
  assert(invalid3.valid === false, 'missing required fails');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
