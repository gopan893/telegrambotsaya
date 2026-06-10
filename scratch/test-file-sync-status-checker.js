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

  const mod = require(path.join(ROOT, 'src/local-integrations/file-sync-status-checker'));

  check(typeof mod.registerSyncJob === 'function', 'registerSyncJob is a function');
  check(typeof mod.getSyncJob === 'function', 'getSyncJob is a function');
  check(typeof mod.updateSyncStatus === 'function', 'updateSyncStatus is a function');
  check(typeof mod.listSyncJobs === 'function', 'listSyncJobs is a function');
  check(typeof mod.getSyncSummary === 'function', 'getSyncSummary is a function');

  const result = mod.registerSyncJob({ id: 'sync1', sourcePath: '/a', targetPath: '/b' });
  check(result.ok === true, 'Register sync job succeeds');

  const summary = mod.getSyncSummary();
  check(typeof summary === 'object' && typeof summary.total === 'number', 'getSyncSummary returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-integrations/file-sync-status-checker.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- File Sync Status Checker: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
