'use strict';

const RcBlockerClassifier = require('../src/release/rc-blocker-classifier');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('\n=== RC Blocker Classifier Tests ===\n');

// 1. classifyRcFinding P0 blocker
const p0Findings = [
  { message: 'AUTO_APPROVE_ENABLED is true — release blocker', category: 'boot' },
  { message: 'node --check telebot.js failed — release blocker', category: 'boot' },
  { message: 'TELEGRAM_TOKEN not configured — release blocker', category: 'boot' },
  { message: 'SHELL_EXECUTOR_ENABLED bypasses governance completely', category: 'governance' },
  { message: 'Secret leakage detected', category: 'security' },
  { message: 'Service worker caches /api/dashboard/', category: 'pwa' }
];
for (const f of p0Findings) {
  const result = RcBlockerClassifier.classifyRcFinding(f);
  assert(result.priority === 'P0', `classifies as P0: ${f.message}`);
}

// 2. classifyRcFinding P1 warning
const p1Findings = [
  { message: 'DASHBOARD_ADMIN_TOKEN not configured — P1', category: 'boot' },
  { message: 'Release Candidate tab not found in known tabs — P1', category: 'dashboard' },
  { message: 'EXECUTOR_APPROVAL_REQUIRED is false — P1 bypass risk', category: 'executor' },
  { message: 'Release docs incomplete', category: 'docs' },
  { message: 'Stale PWA cache version', category: 'pwa' }
];
for (const f of p1Findings) {
  const result = RcBlockerClassifier.classifyRcFinding(f);
  assert(result.priority === 'P1', `classifies as P1: ${f.message}`);
}

// 3. classifyRcFinding P2 known limitation
const p2Finding = { message: 'In-memory stores reset on restart', category: 'runtime' };
const p2Result = RcBlockerClassifier.classifyRcFinding(p2Finding);
assert(p2Result.priority === 'P2', 'classifies as P2 for known limitation');

// 4. isP0ReleaseBlocker
assert(RcBlockerClassifier.isP0ReleaseBlocker({ severity: 'P0', message: 'test' }) === true, 'isP0ReleaseBlocker true for severity P0');
assert(RcBlockerClassifier.isP0ReleaseBlocker({ message: 'auto approve enabled' }) === true, 'isP0ReleaseBlocker true for auto approve');
assert(RcBlockerClassifier.isP0ReleaseBlocker({ message: 'nothing wrong' }) === false, 'isP0ReleaseBlocker false for safe message');
assert(RcBlockerClassifier.isP0ReleaseBlocker(null) === false, 'isP0ReleaseBlocker false for null');

// 5. isP1ProductionFix
assert(RcBlockerClassifier.isP1ProductionFix({ severity: 'P1', message: 'test' }) === true, 'isP1ProductionFix true for severity P1');
assert(RcBlockerClassifier.isP1ProductionFix({ message: 'dashboard route missing' }) === true, 'isP1ProductionFix true for route missing');
assert(RcBlockerClassifier.isP1ProductionFix({ message: 'safe message' }) === false, 'isP1ProductionFix false for safe message');
assert(RcBlockerClassifier.isP1ProductionFix(null) === false, 'isP1ProductionFix false for null');

// 6. buildRcBlockerSummary
const allFindings = [...p0Findings, ...p1Findings, p2Finding];
const summary = RcBlockerClassifier.buildRcBlockerSummary(allFindings);
assert(summary.total > 0, 'summary has total > 0');
// P0: 6 from p0Findings. P1: 5 from p1Findings (none misclassified anymore). P2: 1
assert(summary.p0Count === 6, 'summary p0Count = 6');
assert(summary.p1Count === 5, 'summary p1Count = 5');
assert(summary.p2Count === 1, 'summary p2Count = 1');
assert(summary.blocked === true, 'summary blocked = true with P0');
assert(summary.needsFixBeforeProduction === true, 'needsFixBeforeProduction = true');

// 7. buildRcBlockerSummary with no findings
const emptySummary = RcBlockerClassifier.buildRcBlockerSummary([]);
assert(emptySummary.total === 0, 'empty summary total = 0');
assert(emptySummary.blocked === false, 'empty summary not blocked');

// 8. buildSummaryText
const text = RcBlockerClassifier.buildSummaryText({ p0: [1,2], p1: [1], p2: [1], p3: [1] });
assert(text.includes('2 P0'), 'summary text includes P0 count');
assert(text.includes('1 P1'), 'summary text includes P1 count');

console.log(`\nResult: ${passed} PASS, ${failed} FAIL\n`);
process.exit(failed > 0 ? 1 : 0);
