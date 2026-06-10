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

  check(apiContent.includes('async fetch(url, options)'), 'Api.fetch accepts url and options');
  check(apiContent.includes('opts.method || \'GET\''), 'Default method is GET');
  check(apiContent.includes('JSON.parse(body)'), 'Body is parsed from JSON string');
  check(apiContent.includes('window.fetch(url,') || apiContent.includes('window.fetch(url,'), 'Uses window.fetch internally');
  check(apiContent.includes('response.json()'), 'Parses JSON response');
  check(apiContent.includes('NETWORK_ERROR'), 'Handles network errors');
  check(apiContent.includes('NOT_FOUND'), 'Handles 404');
  check(apiContent.includes('RATE_LIMITED'), 'Handles 429');
  check(apiContent.includes('DASHBOARD_DISABLED'), 'Handles 403');
  check(apiContent.includes('UNAUTHORIZED'), 'Handles 401');

  const dashboardFiles = [
    'plugin-hardening.js', 'rag-quality.js', 'agent-runtime.js',
    'post-v2.js', 'v2-production.js', 'v2-stabilization.js',
    'v2-release.js', 'performance.js', 'boundary.js',
    'registry-v2.js', 'v2-planning.js', 'stabilization.js'
  ];
  for (const f of dashboardFiles) {
    const fp = path.join(ROOT, 'public/dashboard', f);
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf8');
      if (content.includes('Api.fetch')) {
        check(content.includes('Api.fetch('), f + ' uses Api.fetch correctly');
        check(!content.includes('window.fetch('), f + ' does not use raw window.fetch');
      }
    }
  }

  console.log('\n--- Dashboard API Fetch Compat: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
