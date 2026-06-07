'use strict';

const assert = require('assert');
const path = require('path');

const feedbackCollectorPath = require.resolve('../src/improvement/feedback-collector');
const { ImprovementStore } = require('../src/improvement/improvement-store');

async function runTests() {
  console.log('=== test-feedback-collector.js ===');
  const results = [];

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      results.push({ name, passed: true });
    } catch (err) {
      console.log(`  FAIL: ${name} - ${err.message}`);
      results.push({ name, passed: false, error: err.message });
    }
  }

  const collector = require(feedbackCollectorPath);
  const store = new ImprovementStore();

  const services = { store };

  await runTest('collectUserFeedback creates feedback with sanitized text', async () => {
    const fb = await collector.collectUserFeedback({ text: 'Dashboard routing salah arah', userId: 'u1' }, services);
    assert.ok(fb, 'feedback should be returned');
    assert.ok(fb.id, 'feedback should have id');
    assert.strictEqual(fb.source, 'telegram');
    assert.ok(fb.rawTextRedacted, 'should have rawTextRedacted');
  });

  await runTest('collectTelegramFeedback handles message object', async () => {
    const msg = { text: 'Respon lambat sekali', chat: { id: 'chat1' } };
    const ctx = { userId: 'u2' };
    const fb = await collector.collectTelegramFeedback(msg, ctx, services);
    assert.ok(fb, 'feedback should be returned');
    assert.strictEqual(fb.source, 'telegram');
    assert.strictEqual(fb.userId, 'u2');
    assert.strictEqual(fb.chatId, 'chat1');
  });

  await runTest('collectDashboardFeedback handles form input', async () => {
    const fb = await collector.collectDashboardFeedback({ text: 'Saya suka fitur baru ini', userId: 'u3' }, services);
    assert.ok(fb, 'feedback should be returned');
    assert.strictEqual(fb.source, 'dashboard');
  });

  await runTest('sanitizeFeedbackText redacts TELEGRAM_TOKEN', () => {
    const result = collector.sanitizeFeedbackText('TELEGRAM_TOKEN=abc123', services);
    assert.ok(!result.includes('abc123'), 'token value should be redacted');
    assert.ok(result.includes('REDACTED_SECRET'), 'should contain [REDACTED_SECRET]');
  });

  await runTest('sanitizeFeedbackText redacts sk- patterns', () => {
    const result = collector.sanitizeFeedbackText('my key is sk-abc123def456', services);
    assert.ok(!result.includes('sk-abc123def456'), 'sk- should be redacted');
  });

  await runTest('sanitizeFeedbackText redacts ghp_ patterns', () => {
    const result = collector.sanitizeFeedbackText('token is ghp_abcdef123456', services);
    assert.ok(!result.includes('ghp_abcdef123456'), 'ghp_ should be redacted');
  });

  await runTest('auto-classify category from text keywords', () => {
    assert.strictEqual(collector.autoClassifyCategory('Dashboard bug tampilan error'), 'dashboard_bug');
    assert.strictEqual(collector.autoClassifyCategory('deploy gagal terus'), 'deploy_failure');
    assert.strictEqual(collector.autoClassifyCategory('biaya mahal sekali'), 'cost_too_high');
  });

  await runTest('sentiment detection positive/negative', () => {
    assert.strictEqual(collector.detectSentiment('bagus sekali'), 'positive');
    assert.strictEqual(collector.detectSentiment('error terus rusak'), 'negative');
    assert.strictEqual(collector.detectSentiment('halo apa kabar'), 'neutral');
    assert.strictEqual(collector.detectSentiment('bagus tapi error'), 'mixed');
  });

  await runTest('linkFeedbackToTarget links feedback to target', async () => {
    const fb = await collector.collectUserFeedback({ text: 'test link', userId: 'u_link' }, services);
    const linked = collector.linkFeedbackToTarget(fb.id, 'proposal', 'prop_123', services);
    assert.ok(linked, 'should return linked feedback');
    assert.strictEqual(linked.targetType, 'proposal');
    assert.strictEqual(linked.targetId, 'prop_123');
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error('FATAL:', err); process.exit(1); });
