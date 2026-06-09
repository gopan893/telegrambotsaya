'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // Valid manifest
  const validManifest = { id: 'my_plugin', name: 'My Plugin', version: '1.0.0', main: 'index.js', type: 'module' };
  const validResult = plugins.pluginValidator.validatePluginManifest(validManifest);
  assert(validResult.valid === true, 'valid manifest passes');
  assert(validResult.errors.length === 0, 'valid manifest has 0 errors');

  // Invalid manifest - missing fields
  const emptyResult = plugins.pluginValidator.validatePluginManifest({});
  assert(emptyResult.valid === false, 'empty manifest fails');
  assert(emptyResult.errors.length >= 4, 'empty manifest has 4+ errors');

  const noId = plugins.pluginValidator.validatePluginManifest({ name: 'Test', version: '1.0.0', main: 'index.js' });
  assert(noId.valid === false, 'missing id fails');

  // Invalid type
  const badType = plugins.pluginValidator.validatePluginManifest({ id: 'x', name: 'X', version: '1.0.0', main: 'x.js', type: 'foobar' });
  assert(badType.valid === false, 'invalid type fails');
  assert(badType.errors.some(e => e.includes('Invalid type')), 'invalid type error message');

  // Invalid version
  const badVer = plugins.pluginValidator.validatePluginManifest({ id: 'x', name: 'X', version: 'abc', main: 'x.js' });
  assert(badVer.valid === false, 'invalid version fails');

  // Invalid dependencies type
  const badDeps = plugins.pluginValidator.validatePluginManifest({ id: 'x', name: 'X', version: '1.0.0', main: 'x.js', dependencies: 'not-array' });
  assert(badDeps.valid === false, 'non-array deps fails');

  // Invalid permissions type
  const badPerms = plugins.pluginValidator.validatePluginManifest({ id: 'x', name: 'X', version: '1.0.0', main: 'x.js', permissions: 'not-array' });
  assert(badPerms.valid === false, 'non-array permissions fails');

  // validatePluginId
  assert(plugins.pluginValidator.validatePluginId('my_plugin') === true, 'valid pluginId');
  assert(plugins.pluginValidator.validatePluginId('123') === false, 'invalid pluginId starts with digit');
  assert(plugins.pluginValidator.validatePluginId('') === false, 'empty pluginId invalid');

  // validateVersion
  assert(plugins.pluginValidator.validateVersion('1.2.3') === true, 'valid semver');
  assert(plugins.pluginValidator.validateVersion('1.2') === false, 'partial semver invalid');
  assert(plugins.pluginValidator.validateVersion('v1.0.0') === false, 'v prefix invalid');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
