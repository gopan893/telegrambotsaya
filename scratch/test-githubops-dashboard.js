'use strict';

const path = require('path');
const express = require('express');
const githubops = require('../src/githubops');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

// --- Verify githubops module exports ---
console.log('\n--- githubops module exports ---');
assert(typeof githubops.utils === 'object', 'exports utils');
assert(typeof githubops.store === 'object', 'exports store');
assert(typeof githubops.repoState === 'object', 'exports repoState');
assert(typeof githubops.changeManifest === 'object', 'exports changeManifest');
assert(typeof githubops.secretScan === 'object', 'exports secretScan');
assert(typeof githubops.commitPlan === 'object', 'exports commitPlan');
assert(typeof githubops.pushPlan === 'object', 'exports pushPlan');
assert(typeof githubops.pushProposal === 'object', 'exports pushProposal');
assert(typeof githubops.workflowRunProposal === 'object', 'exports workflowRunProposal');
assert(typeof githubops.monitor === 'object', 'exports monitor');
assert(typeof githubops.releaseGate === 'object', 'exports releaseGate');

// --- Verify githubops routes module ---
console.log('\n--- githubops routes module ---');
const ghRoutes = require('../src/dashboard/githubops-routes');
assert(typeof ghRoutes.registerGithubOpsRoutes === 'function', 'exports registerGithubOpsRoutes');

// --- Verify route registration doesn't throw ---
console.log('\n--- route registration ---');
const router = express.Router();
try {
  ghRoutes.registerGithubOpsRoutes(router, {});
  assert(true, 'registerGithubOpsRoutes succeeds');
} catch (e) {
  assert(false, 'registerGithubOpsRoutes throws: ' + e.message);
}

// --- Verify dashboard index export ---
console.log('\n--- dashboard index export ---');
const dashboard = require('../src/dashboard');
assert(typeof dashboard.githubOpsRoutes === 'object', 'dashboard exports githubOpsRoutes');

// --- Test pipeline in non-git dir returns proper error ---
console.log('\n--- pipeline in non-git context ---');
const pipeline = require('../src/githubops/githubops-pipeline');
const result = pipeline.runFullPipeline({ repoRoot: '/tmp' });
assert(result.ok === false, 'pipeline in non-git dir returns ok:false');
assert(result.step === 'repoState', 'pipeline fails at repoState step');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);
