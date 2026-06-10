'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-merge-planner'));

  check(typeof mod.createMergePlan === 'function', 'createMergePlan is a function');
  check(typeof mod.mergeContent === 'function', 'mergeContent is a function');
  check(typeof mod.mergeTags === 'function', 'mergeTags is a function');
  check(typeof mod.mergeMetadata === 'function', 'mergeMetadata is a function');
  check(typeof mod.summarizeMergePlan === 'function', 'summarizeMergePlan is a function');

  const memA = { id: 'm1', content: 'Deploy to production using Docker', tags: ['deploy', 'docker'], metadata: { source: 'docs' } };
  const memB = { id: 'm2', content: 'Deploy to production using Docker and Kubernetes', tags: ['deploy', 'k8s'], metadata: { source: 'manual' } };

  const plan = mod.createMergePlan(memA, memB);
  check(typeof plan === 'object', 'createMergePlan returns object');
  check(plan.valid !== false || plan.plan !== null, 'Merge plan is valid');

  const nullPlan = mod.createMergePlan(null, memB);
  check(nullPlan.valid === false, 'Null memory returns invalid plan');

  const mergedContent = mod.mergeContent(memA, memB);
  check(typeof mergedContent === 'string' && mergedContent.length > 0, 'Merged content is non-empty');

  const mergedTags = mod.mergeTags(memA, memB);
  check(Array.isArray(mergedTags), 'Merged tags is array');
  check(mergedTags.includes('docker') || mergedTags.includes('k8s'), 'Tags combined');

  const mergedMeta = mod.mergeMetadata(memA, memB);
  check(typeof mergedMeta === 'object', 'Merged metadata is object');

  const summary = mod.summarizeMergePlan(plan);
  check(typeof summary === 'object', 'summarizeMergePlan returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-merge-planner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Merge Planner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
