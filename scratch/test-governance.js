/**
 * Local Test Suite: Phase 8 Governance Intelligence System
 *
 * Cara menjalankan:
 * node scratch/test-governance.js
 */

'use strict';

const assert = require('assert');
const governance = require('../src/governance');
const autonomousEngine = require('../src/core/autonomous-engine');

const mockDb = {};
const shortMemory = [];
let calendarInserted = false;

const mockServices = {
  ensureUser: (userId) => {
    if (!mockDb[userId]) {
      mockDb[userId] = {
        botName: 'Bot Governance',
        mode: 'governance-review',
        todos: [],
        reminders: [],
        summary: '- User sedang menguji governance',
        tags: ['governance'],
        nlpPatterns: []
      };
    }
    return mockDb[userId];
  },
  persist: async () => true,
  askAI: async (system, prompt, opts) => {
    const q = String(opts.question || '').toLowerCase();
    if (q.includes('jadwalkan rapat')) {
      return JSON.stringify({
        intent: 'TAMBAH_EVENT',
        confidence: 0.94,
        params: {
          summary: 'Rapat governance',
          startDate: '2026-06-01',
          startTime: '10:00',
          endDate: '2026-06-01',
          endTime: '11:00'
        },
        reason: 'User meminta aksi Calendar write.'
      });
    }
    return JSON.stringify({ intent: 'NONE', confidence: 1, params: {} });
  },
  getSmartAnswer: async () => 'Jawaban fallback governance.',
  safeSendMessage: async () => true,
  sendStreamingAnswer: async () => true,
  pushChatHistory: (entry) => shortMemory.push(entry),
  saveConversationPair: async () => true,
  autoSummarizeMemory: async () => true,
  getSystemPrompt: () => 'Gunakan governance policy.',
  shortMemory,
  env: {
    OWNER_CHAT_ID: 'owner_1',
    ADMIN_SET: new Set(['admin_1'])
  },
  getCalendarClient: async () => ({
    events: {
      insert: async () => {
        calendarInserted = true;
        return { data: { id: 'event_1' } };
      }
    }
  }),
  parseFlexibleDateTime: (value) => {
    const parsed = new Date(`${String(value).replace(' ', 'T')}:00+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  },
  isValidDate: (value) => value instanceof Date && !Number.isNaN(value.getTime())
};

async function runTests() {
  console.log('Memulai test Phase 8 Governance Intelligence...');
  const traceId = 'test-governance-trace';

  const lowRisk = governance.reviewDecision(traceId, {
    userId: 'user_1',
    userMessage: 'hitung 2+2',
    intent: 'HITUNG',
    params: { expression: '2+2' },
    nlpConfidence: 0.95,
    context: {},
    botServices: mockServices
  });
  assert.strictEqual(lowRisk.executionAllowed, true);
  assert.strictEqual(lowRisk.decision, 'ALLOW');

  const blocked = governance.reviewDecision(traceId, {
    userId: 'user_1',
    userMessage: 'reset system sekarang',
    intent: 'RESET_SYSTEM',
    params: {},
    nlpConfidence: 0.95,
    context: {},
    botServices: mockServices
  });
  assert.strictEqual(blocked.executionAllowed, false);
  assert.strictEqual(blocked.decision, 'BLOCKED');

  const approval = governance.reviewDecision(traceId, {
    userId: 'user_2',
    userMessage: 'jadwalkan rapat ke calendar',
    intent: 'TAMBAH_EVENT',
    params: {
      summary: 'Rapat',
      startDate: '2026-06-01',
      startTime: '10:00'
    },
    nlpConfidence: 0.94,
    context: {},
    botServices: mockServices
  });
  assert.strictEqual(approval.executionAllowed, false);
  assert.strictEqual(approval.decision, 'APPROVAL_REQUIRED');
  assert.ok(approval.approvalId);

  const consumed = governance.consumeApprovedAction(
    traceId,
    'user_2',
    `konfirmasi ${approval.approvalId}`,
    mockServices
  );
  assert.strictEqual(consumed.approved, true);
  assert.strictEqual(consumed.intent, 'TAMBAH_EVENT');

  mockServices.ensureUser('rollback_user').todos.push({ text: 'lama', done: false });
  governance.createRecoverySnapshot(traceId, 'rollback_user', 'unit_test', mockServices);
  mockServices.ensureUser('rollback_user').todos.push({ text: 'baru', done: false });
  const rollback = governance.rollbackLastSnapshot(traceId, 'rollback_user', mockServices);
  assert.strictEqual(rollback.ok, true);
  assert.strictEqual(mockServices.ensureUser('rollback_user').todos.length, 1);

  const first = await autonomousEngine.processMessage(
    'calendar_user',
    'chat_1',
    'Jadwalkan rapat governance tanggal 2026-06-01 jam 10 ke Google Calendar.',
    { message_id: 1 },
    mockServices
  );
  assert.strictEqual(first.processed, true);
  assert.ok(first.answerText.includes('konfirmasi'), 'Aksi Calendar write harus meminta approval.');
  assert.strictEqual(calendarInserted, false);

  const approvalId = first.answerText.match(/konfirmasi ([a-f0-9]{8})/)?.[1];
  assert.ok(approvalId, 'Approval id tidak ditemukan di respons.');

  const second = await autonomousEngine.processMessage(
    'calendar_user',
    'chat_1',
    `konfirmasi ${approvalId}`,
    { message_id: 2 },
    mockServices
  );
  assert.strictEqual(second.processed, true);
  assert.strictEqual(calendarInserted, true, 'Aksi approved tidak dieksekusi.');

  const status = autonomousEngine.getRuntimeStatus();
  assert.ok(status.governance.audit.recentAuditCount > 0);

  console.log('Semua test Phase 8 Governance Intelligence berhasil.');
}

runTests().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
