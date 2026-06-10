'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/module-manifest-registry'));
  const manifests = mod.listModuleManifests();
  assert.ok(manifests, 'listModuleManifests should return manifests');
  assert.ok(Array.isArray(manifests), 'manifests should be an array');
  assert.ok(manifests.length >= 10, 'manifests should have at least 10 entries');
  console.log('PASS: test-module-manifest-registry — listModuleManifests returns manifests array with at least 10 entries');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
