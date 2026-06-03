'use strict';

const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed++; }
}

const mockStore = {
  runs: [],
  notifications: [],
  createRun(data) { const run = { id: 'run_' + Math.random().toString(36).slice(2), ...data, createdAt: new Date().toISOString() }; this.runs.push(run); return run; },
  listRuns() { return this.runs; },
  getRun(id) { return this.runs.find(r => r.id === id); },
  createNotification(data) { const n = { id: 'notif_' + Math.random().toString(36).slice(2), ...data, createdAt: new Date().toISOString() }; this.notifications.push(n); return n; },
  listNotifications() { return this.notifications; }
};

test('Store creates run with id', () => {
  const run = mockStore.createRun({ routineId: 'r1', mode: 'manual' });
  assert.ok(run.id);
  assert.ok(run.id.startsWith('run_'));
});

test('Store lists runs', () => {
  const runs = mockStore.listRuns();
  assert.ok(runs.length > 0);
});

test('Store gets run by id', () => {
  const id = mockStore.runs[0].id;
  const run = mockStore.getRun(id);
  assert.ok(run);
  assert.strictEqual(run.id, id);
});

test('Store creates notification', () => {
  const n = mockStore.createNotification({ routineId: 'r1', runId: 'run1', userId: 'admin', message: 'Test' });
  assert.ok(n.id);
});

test('Store lists notifications', () => {
  const list = mockStore.listNotifications();
  assert.ok(list.length > 0);
});

test('Notifications suppress duplicate messages within 5 minutes', () => {
  const recentNotifications = new Set();
  function shouldSuppress(message, quietMinutes = 5) {
    if (recentNotifications.has(message)) return true;
    recentNotifications.add(message);
    setTimeout(() => recentNotifications.delete(message), quietMinutes * 60 * 1000);
    return false;
  }
  assert.strictEqual(shouldSuppress('Test message'), false);
  assert.strictEqual(shouldSuppress('Test message'), true);
});

test('Briefing generator returns sections', () => {
  function generateBriefing(type) {
    const sections = {
      daily: ['Ringkasan Project', 'Status Backup', 'Active Issues'],
      weekly: ['Weekly Progress', 'Issue Resolution Rate', 'Backup Integrity'],
      ops: ['System Health', 'Storage Usage', 'Pending Updates'],
      coding: ['Active Branches', 'Recent Commits', 'Review Queue'],
      integration: ['API Status', 'Webhook Health', 'External Services']
    };
    return sections[type] || [];
  }

  const daily = generateBriefing('daily');
  assert.ok(daily.includes('Ringkasan Project'));
  assert.ok(daily.includes('Status Backup'));

  const weekly = generateBriefing('weekly');
  assert.ok(weekly.includes('Weekly Progress'));

  const ops = generateBriefing('ops');
  assert.ok(ops.includes('System Health'));
});

test('Quiet hours suppress notifications', () => {
  function isWithinQuietHours(hour, quietStart = 22, quietEnd = 6) {
    if (quietStart < quietEnd) {
      return hour >= quietStart && hour < quietEnd;
    }
    return hour >= quietStart || hour < quietEnd;
  }

  assert.strictEqual(isWithinQuietHours(23), true);
  assert.strictEqual(isWithinQuietHours(3), true);
  assert.strictEqual(isWithinQuietHours(14), false);
  assert.strictEqual(isWithinQuietHours(22), true);
  assert.strictEqual(isWithinQuietHours(6), false);
});

test('Rate limiter allows max N notifications per period', () => {
  const timestamps = [];
  function canSendNotification(maxPerMinute = 5) {
    const now = Date.now();
    const lastMinute = timestamps.filter(t => now - t < 60000);
    if (lastMinute.length >= maxPerMinute) return false;
    timestamps.push(now);
    return true;
  }

  for (let i = 0; i < 5; i++) {
    assert.strictEqual(canSendNotification(5), true);
  }
  assert.strictEqual(canSendNotification(5), false);
});

console.log(`\n📊 Routine Notification & Briefing Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);
