'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Post-V2 Dashboard API ===\n');

  const routePath = path.join(ROOT, 'src/dashboard/post-v2-routes.js');
  const dashJsPath = path.join(ROOT, 'public/dashboard/post-v2.js');

  check(fs.existsSync(routePath), 'post-v2-routes.js exists');
  check(fs.existsSync(dashJsPath), 'post-v2.js exists');

  const routes = require(routePath);
  check(typeof routes.registerPostV2Routes === 'function', 'registerPostV2Routes exported');

  try {
    execSync('node --check "' + routePath + '"', { stdio: 'pipe' });
    check(true, 'Route file passes syntax check');
  } catch (e) {
    check(false, 'Route file syntax check failed: ' + (e.stderr || '').toString().trim());
  }

  try {
    execSync('node --check "' + dashJsPath + '"', { stdio: 'pipe' });
    check(true, 'Dashboard JS passes syntax check');
  } catch (e) {
    check(false, 'Dashboard JS syntax check failed: ' + (e.stderr || '').toString().trim());
  }

  const dashContent = fs.readFileSync(dashJsPath, 'utf8');
  check(dashContent.includes('UI.renderPostV2'), 'Dashboard JS registers UI.renderPostV2');

  const routeContent = fs.readFileSync(routePath, 'utf8');
  check(!routeContent.includes('TELEGRAM_TOKEN'), 'Route file does not contain TELEGRAM_TOKEN literal');
  check(!routeContent.includes('GITHUB_TOKEN'), 'Route file does not contain GITHUB_TOKEN literal');

  console.log('\n=== Dashboard API: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
