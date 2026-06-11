'use strict';

const assert = require('assert');

console.log('=== Registry v3 Version Manager Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const versionManager = require('../src/registry-v3/registry-v3-version-manager');

  store.clear();

  const services = { store, logger: console };

  console.log('Testing getCurrentRegistryV3Version...');
  const version = versionManager.getCurrentRegistryV3Version(services);
  assert.ok(version !== undefined);
  console.log('  PASS: current version returned');

  console.log('Testing proposeRegistryV3VersionBump...');
  const bump = versionManager.proposeRegistryV3VersionBump({ type: 'patch', description: 'Update docs' }, services);
  assert.ok(bump);
  console.log('  PASS: version bump proposed');

  console.log('Testing classifyRegistryV3VersionChange...');
  const patchChange = versionManager.classifyRegistryV3VersionChange({ type: 'patch' }, services);
  assert.ok(patchChange);
  console.log('  PASS: patch change classified');

  const minorChange = versionManager.classifyRegistryV3VersionChange({ type: 'minor' }, services);
  assert.ok(minorChange);
  console.log('  PASS: minor change classified');

  const majorChange = versionManager.classifyRegistryV3VersionChange({ type: 'major' }, services);
  assert.ok(majorChange);
  console.log('  PASS: major change classified');

  console.log('Testing buildRegistryV3VersionReport...');
  const report = versionManager.buildRegistryV3VersionReport(services);
  assert.ok(report);
  console.log('  PASS: version report built');

  store.clear();

  console.log('\n✅ All registry v3 version manager tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}