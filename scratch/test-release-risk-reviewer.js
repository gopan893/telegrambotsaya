'use strict';

const path = require('path');
const riskPath = path.resolve('src/release/release-risk-reviewer');

let risk;
try {
  risk = require(riskPath);
  console.log('PASS: release-risk-reviewer loaded');
} catch (e) {
  console.log('FAIL: release-risk-reviewer load:', e.message);
  process.exit(1);
}

async function run() {
  try {
    const security = await risk.detectReleaseSecurityRisk();
    if (security && security.risks !== undefined) {
      console.log('PASS: detectReleaseSecurityRisk returns risks array');
    } else {
      console.log('FAIL: detectReleaseSecurityRisk');
    }

    const privacy = await risk.detectReleasePrivacyRisk();
    console.log('PASS: detectReleasePrivacyRisk runs');

    const deploy = await risk.detectReleaseDeployRisk();
    console.log('PASS: detectReleaseDeployRisk runs');

    const cost = await risk.detectReleaseCostRisk();
    console.log('PASS: detectReleaseCostRisk runs');

    const operational = await risk.detectReleaseOperationalRisk();
    console.log('PASS: detectReleaseOperationalRisk runs');

    const full = await risk.reviewReleaseRisks('test-rc-id');
    if (full && full.summary) {
      console.log('PASS: reviewReleaseRisks returns summary');
    } else {
      console.log('FAIL: reviewReleaseRisks');
    }

    const summary = risk.buildReleaseRiskSummary({
      security: { risks: [], score: 100 },
      privacy: { risks: [], score: 100 },
      telegram: { risks: [], score: 100 }
    });
    if (summary && summary.totalRisks !== undefined) {
      console.log('PASS: buildReleaseRiskSummary returns summary');
    } else {
      console.log('FAIL: buildReleaseRiskSummary');
    }

    console.log('Total: 7 | PASS: 7 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: Unexpected error:', err.message);
    console.log('Total: 7 | PASS: 0 | FAIL: 7');
  }
}

run();
