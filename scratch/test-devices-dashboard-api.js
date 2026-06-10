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

  const routeFile = path.join(ROOT, 'src/dashboard/devices-routes.js');
  check(fs.existsSync(routeFile), 'devices-routes.js exists');

  const routeContent = fs.readFileSync(routeFile, 'utf8');
  check(!routeContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in route file');
  check(!routeContent.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in route file');

  try {
    new Function(routeContent);
    check(true, 'Route file passes syntax check');
  } catch (e) {
    check(false, 'Route file syntax error: ' + e.message);
  }

  const jsFile = path.join(ROOT, 'public/dashboard/devices.js');
  check(fs.existsSync(jsFile), 'devices.js frontend exists');

  if (fs.existsSync(jsFile)) {
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    check(!jsContent.includes('TELEGRAM_TOKEN'), 'Frontend JS has no TELEGRAM_TOKEN');
    check(!jsContent.includes('GITHUB_TOKEN'), 'Frontend JS has no GITHUB_TOKEN');
  }

  const stateContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');
  check(stateContent.includes("'devices'"), 'state.js has devices tab entry');

  const indexContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
  check(indexContent.includes('data-tab="devices"'), 'index.html has devices sidebar entry');

  const swContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/service-worker.js'), 'utf8');
  check(swContent.includes('/dashboard/devices.js'), 'service-worker.js has devices.js');

  console.log('\n--- Devices Dashboard API: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
