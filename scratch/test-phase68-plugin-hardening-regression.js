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

  const routeFile = path.join(ROOT, 'src/dashboard/plugin-hardening-routes.js');
  check(fs.existsSync(routeFile), 'plugin-hardening-routes.js exists');

  const routeContent = fs.readFileSync(routeFile, 'utf8');
  check(!routeContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in route file');
  check(!routeContent.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in route file');

  try {
    new Function(routeContent);
    check(true, 'Route file passes syntax check');
  } catch (e) {
    check(false, 'Route file syntax error: ' + e.message);
  }

  const jsFile = path.join(ROOT, 'src/dashboard/plugin-hardening-routes.js');
  check(fs.existsSync(jsFile), 'Dashboard JS file exists');

  const plugins = [
    'plugin-compatibility-checker', 'plugin-permission-versioning', 'plugin-sandbox-policy',
    'plugin-lifecycle-manager', 'plugin-health-monitor', 'plugin-risk-simulator',
    'plugin-upgrade-planner', 'plugin-deprecation-manager', 'plugin-docs-generator',
    'plugin-certification-gate'
  ];

  for (const p of plugins) {
    const filePath = path.join(ROOT, 'src/plugin-hardening/' + p + '.js');
    check(fs.existsSync(filePath), p + '.js exists');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      check(!content.includes('TELEGRAM_TOKEN'), p + ' has no TELEGRAM_TOKEN');
      check(!content.includes('GITHUB_TOKEN'), p + ' has no GITHUB_TOKEN');
      try {
        new Function(content);
        check(true, p + ' passes syntax check');
      } catch (e) {
        check(false, p + ' syntax error: ' + e.message);
      }
    }
  }

  const connectors = [
    'connector-test-harness', 'connector-contract-validator', 'connector-permission-auditor',
    'connector-readonly-simulator', 'connector-write-proposal-simulator', 'connector-health-monitor'
  ];

  for (const c of connectors) {
    const filePath = path.join(ROOT, 'src/connector-hardening/' + c + '.js');
    check(fs.existsSync(filePath), c + '.js exists');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      check(!content.includes('TELEGRAM_TOKEN'), c + ' has no TELEGRAM_TOKEN');
      check(!content.includes('GITHUB_TOKEN'), c + ' has no GITHUB_TOKEN');
      try {
        new Function(content);
        check(true, c + ' passes syntax check');
      } catch (e) {
        check(false, c + ' syntax error: ' + e.message);
      }
    }
  }

  console.log('\n--- Phase 68 Plugin Hardening Regression: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
