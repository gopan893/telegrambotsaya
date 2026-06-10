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

  const rendererFiles = [
    'v2-release.js', 'v2-production.js', 'post-v2.js',
    'plugin-hardening.js', 'rag-quality.js', 'agent-runtime.js'
  ];

  for (const f of rendererFiles) {
    const fp = path.join(ROOT, 'public/dashboard', f);
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf8');
      check(content.includes('Api.fetch'), f + ' uses Api.fetch');
      check(!content.includes('Api.fetch is not'), f + ' does not check for undefined Api.fetch');
      check(content.includes('catch') || content.includes('error') || content.includes('Error'), f + ' has error handling');
      check(content.includes('UI.renderError') || content.includes('renderEmptyState') || content.includes('renderLoading'), f + ' has degraded/error rendering');
    }
  }

  const apiFile = path.join(ROOT, 'public/dashboard/api.js');
  const apiContent = fs.readFileSync(apiFile, 'utf8');
  check(apiContent.includes('NETWORK_ERROR'), 'api.js handles network errors gracefully');
  check(apiContent.includes('return { ok: false'), 'api.js returns ok:false on errors instead of throwing');

  console.log('\n--- Dashboard Release API Renderer: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
