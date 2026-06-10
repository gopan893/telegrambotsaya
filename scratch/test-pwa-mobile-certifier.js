'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const sw = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'service-worker.js'), 'utf8');
  assert.ok(sw.includes("url.pathname.startsWith('/api/dashboard')"), 'SW excludes /api/dashboard');
  assert.ok(sw.includes('CACHE_NAME'), 'SW has CACHE_NAME');

  const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('menu-toggle'), 'Mobile menu toggle exists');

  const certifier = require(path.join(ROOT, 'src/stabilization/pwa-mobile-certifier'));
  const result = await certifier.certifyAllPwaMobile();
  assert.ok(result.passed, 'PWA/mobile certifier passed');
  console.log('PASS: test-pwa-mobile-certifier — all checks passed\n');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
