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

  const apiContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/api.js'), 'utf8');

  check(apiContent.includes('async fetch('), 'Api.fetch method exists');
  check(apiContent.includes('Api.get =') || apiContent.includes('Api.get='), 'Api.get alias exists');
  check(apiContent.includes('Api.post =') || apiContent.includes('Api.post='), 'Api.post alias exists');
  check(apiContent.includes('window.Api = Api'), 'window.Api is set');
  check(!apiContent.includes('Api.fetch = undefined'), 'Api.fetch is not set to undefined');

  check(apiContent.includes('async request('), 'Api.request method exists');
  check(apiContent.includes('async apiGet('), 'Api.apiGet method exists');
  check(apiContent.includes('async apiPost('), 'Api.apiPost method exists');

  check(!apiContent.includes("'TELEGRAM_TOKEN'"), 'No TELEGRAM_TOKEN literal in api.js');
  check(!apiContent.includes("'GITHUB_TOKEN'"), 'No GITHUB_TOKEN literal in api.js');
  check(!apiContent.includes("'DATABASE_URL'"), 'No DATABASE_URL literal in api.js');

  try { new Function(apiContent); check(true, 'api.js syntax OK'); } catch (e) { check(false, 'api.js syntax: ' + e.message); }

  console.log('\n--- Dashboard API Client Shim: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
