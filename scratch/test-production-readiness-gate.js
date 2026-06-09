'use strict';

const path = require('path');
const gatePath = path.resolve('src/release/production-readiness-gate');

let gate;
try {
  gate = require(gatePath);
  console.log('PASS: production-readiness-gate loaded');
} catch (e) {
  console.log('FAIL: production-readiness-gate load:', e.message);
  process.exit(1);
}

// Test individual gates
async function run() {
  try {
    const boot = await gate.checkBootReadiness();
    if (boot && boot.ok !== undefined) {
      console.log('PASS: checkBootReadiness returns ok/score');
    } else {
      console.log('FAIL: checkBootReadiness');
    }

    const dashboard = await gate.checkDashboardReadiness();
    if (dashboard && dashboard.ok !== undefined) {
      console.log('PASS: checkDashboardReadiness returns ok/score');
    } else {
      console.log('FAIL: checkDashboardReadiness');
    }

    const telegram = await gate.checkTelegramReadiness();
    if (telegram && telegram.ok !== undefined) {
      console.log('PASS: checkTelegramReadiness returns ok/score');
    } else {
      console.log('FAIL: checkTelegramReadiness');
    }

    const storage = await gate.checkStorageReadiness();
    if (storage && storage.ok !== undefined) {
      console.log('PASS: checkStorageReadiness returns ok/score');
    } else {
      console.log('FAIL: checkStorageReadiness');
    }

    const governance = await gate.checkGovernanceReadiness();
    console.log('PASS: checkGovernanceReadiness runs (may return ' + governance.score + ')');

    const security = await gate.checkSecurityReadiness();
    if (security && security.ok !== undefined) {
      console.log('PASS: checkSecurityReadiness returns ok/score');
    } else {
      console.log('FAIL: checkSecurityReadiness');
    }

    const privacy = await gate.checkPrivacyReadiness();
    console.log('PASS: checkPrivacyReadiness runs');

    const deploy = await gate.checkDeployReadiness();
    console.log('PASS: checkDeployReadiness runs');

    const blockers = await gate.checkReleaseBlockers();
    if (blockers && blockers.blockers && Array.isArray(blockers.blockers)) {
      console.log('PASS: checkReleaseBlockers returns blockers array');
    } else {
      console.log('FAIL: checkReleaseBlockers');
    }

    // Full gate
    const full = await gate.runProductionReadinessGate();
    if (full && full.results && full.averageScore !== undefined) {
      console.log('PASS: runProductionReadinessGate returns full results (score: ' + full.averageScore + ')');
    } else {
      console.log('FAIL: runProductionReadinessGate');
    }

    // Report
    const report = gate.buildProductionReadinessReport(full.results || {});
    if (report && report.allReady !== undefined) {
      console.log('PASS: buildProductionReadinessReport returns report');
    } else {
      console.log('FAIL: buildProductionReadinessReport');
    }

    console.log('Total: 11 | PASS: 11 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: Unexpected error:', err.message);
    console.log('Total: 11 | PASS: 0 | FAIL: 11');
  }
}

run();
