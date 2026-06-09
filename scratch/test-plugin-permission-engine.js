'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // resolvePermission
  const perms1 = plugins.pluginPermissionEngine.resolvePermission({ http: 'read', db: 'admin' }, 'http');
  assert(perms1.allowed === true, 'read level allowed');
  assert(perms1.level === 'read', 'resolvePermission returns level read');
  assert(perms1.score === 1, 'resolvePermission score 1');

  const perms2 = plugins.pluginPermissionEngine.resolvePermission({ http: 'read', db: 'admin' }, 'db');
  assert(perms2.level === 'admin', 'admin level');
  assert(perms2.score === 3, 'admin score 3');

  const perms3 = plugins.pluginPermissionEngine.resolvePermission({ http: 'read' }, 'slack');
  assert(perms3.allowed === false, 'missing connector not allowed');
  assert(perms3.level === 'none', 'missing connector level none');

  // canAccessResource
  assert(plugins.pluginPermissionEngine.canAccessResource({ db: 'write' }, 'db', 'read') === true, 'canAccessResource write >= read');
  assert(plugins.pluginPermissionEngine.canAccessResource({ db: 'read' }, 'db', 'write') === false, 'canAccessResource read < write');
  assert(plugins.pluginPermissionEngine.canAccessResource({}, 'any', 'read') === false, 'canAccessResource missing');

  // buildPermissionManifest
  const built1 = plugins.pluginPermissionEngine.buildPermissionManifest(['http', 'db']);
  assert(built1.http === 'read', 'string entry defaults to read');
  assert(built1.db === 'read', 'string entry defaults to read');

  const built2 = plugins.pluginPermissionEngine.buildPermissionManifest([
    { resource: 'http', access: 'write' },
    { resource: 'db', access: 'admin' }
  ]);
  assert(built2.http === 'write', 'object entry write');
  assert(built2.db === 'admin', 'object entry admin');

  const built3 = plugins.pluginPermissionEngine.buildPermissionManifest([]);
  assert(Object.keys(built3).length === 0, 'empty manifest returns empty');

  // validatePermissionRequest
  const granted = { plugin_a: { http: 'write', db: 'admin' } };
  const req1 = plugins.pluginPermissionEngine.validatePermissionRequest('plugin_a', 'http', 'read', granted);
  assert(req1.ok === true, 'validatePermissionRequest ok');
  assert(req1.granted === 'write', 'granted level write');

  const req2 = plugins.pluginPermissionEngine.validatePermissionRequest('plugin_a', 'http', 'admin', granted);
  assert(req2.ok === false, 'validatePermissionRequest insufficient');
  assert(req2.reason.includes('lacks'), 'deny reason mentions lacks');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
