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

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-sensitivity-classifier'));

  check(typeof mod.classifySensitivity === 'function', 'classifySensitivity is a function');
  check(typeof mod.classifyBatch === 'function', 'classifyBatch is a function');
  check(typeof mod.getSensitivityDistribution === 'function', 'getSensitivityDistribution is a function');
  check(typeof mod.shouldBlockFromRag === 'function', 'shouldBlockFromRag is a function');
  check(typeof mod.isOwnerOnly === 'function', 'isOwnerOnly is a function');
  check(typeof mod.isRagSafe === 'function', 'isRagSafe is a function');

  const publicMem = { id: 'm1', content: 'Deploy instructions for the team', sensitivity: 'internal_project' };
  const publicClass = mod.classifySensitivity(publicMem);
  check(typeof publicClass === 'object', 'classifySensitivity returns object');
  check(typeof publicClass.level === 'string', 'Has level field');

  const secretMem = { id: 'm2', content: 'API_KEY=abc123def456ghi789jkl012mno' };
  const secretClass = mod.classifySensitivity(secretMem);
  check(secretClass.level === 'secret_blocked', 'Secret content classified as blocked');

  const lifeosMem = { id: 'm3', content: 'My mood today is happy and productive', sensitivity: 'lifeos_private' };
  const lifeosClass = mod.classifySensitivity(lifeosMem);
  check(lifeosClass.level === 'lifeos_private' || lifeosClass.level === 'privacy_sensitive', 'LifeOS content classified as private');

  const batch = mod.classifyBatch([publicMem, secretMem, lifeosMem]);
  check(Array.isArray(batch), 'classifyBatch returns array');

  const dist = mod.getSensitivityDistribution([publicMem, secretMem, lifeosMem]);
  check(typeof dist === 'object', 'getSensitivityDistribution returns object');

  check(mod.shouldBlockFromRag(secretClass) === true, 'Secret blocked from RAG');
  check(mod.shouldBlockFromRag(publicClass) === false, 'Public not blocked from RAG');

  check(mod.isOwnerOnly(lifeosClass) === true || mod.isOwnerOnly(secretClass) === true, 'Private data is owner-only');
  check(mod.isRagSafe(publicClass) === true, 'Public data is RAG safe');
  check(mod.isRagSafe(secretClass) === false, 'Secret data not RAG safe');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-sensitivity-classifier.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Sensitivity Classifier: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
