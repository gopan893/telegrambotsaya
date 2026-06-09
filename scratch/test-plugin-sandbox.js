'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // createSandboxContext
  const ctx = plugins.pluginSandbox.createSandboxContext('test_plugin', { allowedResources: ['db:read', 'http:out'] });
  assert(ctx && ctx.pluginId === 'test_plugin', 'createSandboxContext sets pluginId');
  assert(ctx.api && typeof ctx.api.log === 'function', 'sandbox context has log function');
  assert(Array.isArray(ctx.__allowedGlobals), 'sandbox has __allowedGlobals');
  assert(ctx.__allowedGlobals.includes('console'), '__allowedGlobals includes console');
  assert(ctx.__allowedGlobals.includes('Promise'), '__allowedGlobals includes Promise');

  const ctxMin = plugins.pluginSandbox.createSandboxContext('minimal', {});
  assert(ctxMin.pluginId === 'minimal', 'minimal context works');

  // validateSandboxAccess
  const access1 = plugins.pluginSandbox.validateSandboxAccess(ctx, 'db:read');
  assert(access1.allowed === true, 'allowed resource passes');

  const access2 = plugins.pluginSandbox.validateSandboxAccess(ctx, 'db:write');
  assert(access2.allowed === false, 'disallowed resource blocked');
  assert(access2.reason.includes('db:write'), 'blocked resource has reason');

  const access3 = plugins.pluginSandbox.validateSandboxAccess({}, 'anything');
  assert(access3.allowed === false, 'invalid context blocked');
  assert(access3.reason === 'No sandbox context', 'invalid context reason');

  // Wildcard access
  const ctxWild = plugins.pluginSandbox.createSandboxContext('wild', { allowedResources: ['*'] });
  const access4 = plugins.pluginSandbox.validateSandboxAccess(ctxWild, 'any_resource');
  assert(access4.allowed === true, 'wildcard resource passes');

  // isPathAllowed
  assert(plugins.pluginSandbox.isPathAllowed('/data/plugins/test', ['/data/plugins']) === true, 'allowed path');
  assert(plugins.pluginSandbox.isPathAllowed('/etc/passwd', ['/data/plugins']) === false, 'disallowed path');
  assert(plugins.pluginSandbox.isPathAllowed('/anything', ['*']) === true, 'wildcard path allowed');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
