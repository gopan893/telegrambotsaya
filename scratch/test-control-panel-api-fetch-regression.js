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

  const indexHtml = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
  check(indexHtml.includes('api.js'), 'api.js is loaded in index.html');

  const apiScriptPos = indexHtml.indexOf('api.js');
  check(apiScriptPos > -1, 'api.js found in index.html');

  const apiContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/api.js'), 'utf8');
  check(apiContent.includes('window.Api = Api'), 'window.Api is set globally');
  check(apiContent.includes('async fetch('), 'Api.fetch is defined');

  const dashboardDir = path.join(ROOT, 'public/dashboard');
  const files = fs.readdirSync(dashboardDir).filter(f => f.endsWith('.js'));
  let filesUsingFetch = 0;
  for (const f of files) {
    const content = fs.readFileSync(path.join(dashboardDir, f), 'utf8');
    if (content.includes('Api.fetch(')) {
      filesUsingFetch++;
      check(!content.includes('Api.fetch()'), f + ' passes URL to Api.fetch');
    }
  }
  check(filesUsingFetch > 0, 'Found ' + filesUsingFetch + ' files using Api.fetch');

  const swContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/service-worker.js'), 'utf8');
  check(swContent.includes('api/dashboard'), 'Service worker excludes /api/dashboard/* from cache');
  check(!swContent.includes('v50-hotfix'), 'Service worker cache version is bumped');

  console.log('\n--- Control Panel API Fetch Regression: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
