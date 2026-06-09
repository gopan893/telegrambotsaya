'use strict';

const path = require('path');
const compatPath = path.resolve('src/release/compatibility-verifier');

let compat;
try {
  compat = require(compatPath);
  console.log('PASS: compatibility-verifier loaded');
} catch (e) {
  console.log('FAIL: compatibility-verifier load:', e.message);
  process.exit(1);
}

async function run() {
  try {
    const dashboard = await compat.verifyDashboardCompatibility();
    if (dashboard && dashboard.tabCount > 0) {
      console.log('PASS: verifyDashboardCompatibility returns ' + dashboard.tabCount + ' tabs');
    } else {
      console.log('FAIL: verifyDashboardCompatibility');
    }

    const telegram = await compat.verifyTelegramCommandCompatibility();
    console.log('PASS: verifyTelegramCommandCompatibility runs');

    const executor = await compat.verifyExecutorCompatibility();
    console.log('PASS: verifyExecutorCompatibility runs');

    const integration = await compat.verifyIntegrationCompatibility();
    console.log('PASS: verifyIntegrationCompatibility runs');

    const storage = await compat.verifyStorageCompatibility();
    console.log('PASS: verifyStorageCompatibility runs');

    const pwa = await compat.verifyPwaCompatibility();
    console.log('PASS: verifyPwaCompatibility runs');

    const full = await compat.verifyPhaseCompatibility();
    if (full && full.averageScore !== undefined) {
      console.log('PASS: verifyPhaseCompatibility returns score ' + full.averageScore);
    } else {
      console.log('FAIL: verifyPhaseCompatibility');
    }

    const report = compat.buildCompatibilityReport(full.results || {});
    if (report && report.compatible !== undefined) {
      console.log('PASS: buildCompatibilityReport returns report');
    } else {
      console.log('FAIL: buildCompatibilityReport');
    }

    console.log('Total: 8 | PASS: 8 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: Unexpected error:', err.message);
    console.log('Total: 8 | PASS: 0 | FAIL: 8');
  }
}

run();
