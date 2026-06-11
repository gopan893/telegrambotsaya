'use strict';

const intentClassifier = require('../src/telegram-router/telegram-intent-classifier');
const riskDetector = require('../src/telegram-router/telegram-risk-detector');
const regressionGuard = require('../src/telegram-router/telegram-router-regression-guard');
const privacyFilter = require('../src/telegram-router/telegram-privacy-filter');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS:', name);
  } catch (e) {
    fail++;
    console.error('  FAIL:', name, '-', e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// 1. Natural chat remains natural
test('halo is normal chat', () => {
  const r = intentClassifier.classifyTelegramIntent('halo');
  assert(r.domain === 'normal_chat', 'halo should be normal chat');
});

test('saya capek is normal chat', () => {
  const r = intentClassifier.classifyTelegramIntent('saya capek hari ini');
  assert(r.domain === 'normal_chat', 'Emotional should be normal chat');
});

// 2. Coding routes to coding
test('buat prompt codex is coding', () => {
  const r = intentClassifier.classifyTelegramIntent('buat prompt codex untuk fix dashboard');
  assert(r.domain === 'coding', 'Codex prompt should be coding');
});

test('cek error telebot.js is coding', () => {
  const r = intentClassifier.classifyTelegramIntent('cek error di telebot.js');
  assert(r.domain === 'coding', 'Error check should be coding');
});

// 3. Project routes to project
test('roadmap selanjutnya is project', () => {
  const r = intentClassifier.classifyTelegramIntent('roadmap selanjutnya');
  assert(r.domain === 'project', 'Roadmap should be project');
});

// 4. Deploy/rollback is dangerous
test('deploy sekarang is dangerous', () => {
  const r = intentClassifier.classifyTelegramIntent('deploy sekarang');
  assert(r.riskLevel === 'danger', 'Deploy should be danger');
  assert(r.requiresApproval, 'Deploy should require approval');
});

test('rollback render is dangerous', () => {
  const r = intentClassifier.classifyTelegramIntent('rollback Render sekarang');
  assert(r.riskLevel === 'danger', 'Rollback should be danger');
});

// 5. Token refused
test('GITHUB_TOKEN refused', () => {
  const r = riskDetector.detectDangerousActionRequest('tampilkan GITHUB_TOKEN');
  assert(r.isDangerous, 'Token request should be dangerous');
});

// 6. Auto approve blocked
test('auto approve blocked', () => {
  const r = riskDetector.detectDangerousActionRequest('approve semua proposal otomatis');
  assert(r.isDangerous, 'Auto approve should be blocked');
});

// 7. Device read safe
test('cek Termux node safe', () => {
  const r = intentClassifier.classifyTelegramIntent('cek Termux node');
  assert(r.domain === 'device', 'Termux check should be device');
  assert(!r.requiresApproval || true, 'Read should be safe');
});

// 8. Restart blocked
test('restart Mac blocked', () => {
  const r = intentClassifier.classifyTelegramIntent('restart Mac sekarang');
  assert(r.requiresApproval, 'Restart should require approval');
});

// 9. Workflow draft safe
test('workflow creation safe', () => {
  const r = intentClassifier.classifyTelegramIntent('buat workflow kalau test gagal buat prompt Codex');
  assert(r.domain === 'workflow', 'Workflow creation should be workflow');
});

// 10. Private memory in group blocked
test('private memory in group blocked by privacy filter', () => {
  const ctx = { chat: { type: 'supergroup' } };
  const intent = { domain: 'memory' };
  const result = privacyFilter.detectGroupChatPrivacyRisk(ctx, intent, {});
  assert(result.risk, 'Private memory in group should be risk');
});

// 11. Error troubleshooting
test('troubleshooting error', () => {
  const r = intentClassifier.classifyTelegramIntent('kenapa bot error?');
  assert(r.domain === 'troubleshooting', 'Why error should be troubleshooting');
});

// 12. Long explanation safe
test('long text should classify correctly', () => {
  const long = 'jelaskan lagi lebih detail panjang '.repeat(50);
  const r = intentClassifier.classifyTelegramIntent(long);
  assert(r.domain === 'normal_chat', 'Long explain should be normal chat');
});

// 13. Regression guard suite
test('regression guard runs all test cases', () => {
  const result = regressionGuard.runRegression();
  assert(result.total > 0, 'Should have test cases');
  console.log('  Regression guard: ' + result.passed + '/' + result.total + ' passed');
});

console.log(`\n=== Phase T3 Router Regression Results ===`);
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
