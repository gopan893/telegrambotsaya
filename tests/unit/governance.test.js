'use strict';

const governance = require('../../src/governance');

describe('Governance Intelligence', () => {
  const mockDb = {};
  let calendarInserted = false;

  const mockServices = {
    ensureUser: (userId) => {
      if (!mockDb[userId]) {
        mockDb[userId] = {
          botName: 'Bot Governance',
          mode: 'governance-review',
          todos: [], reminders: [],
          summary: '- User sedang menguji governance',
          tags: ['governance'], nlpPatterns: []
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
          params: { summary: 'Rapat governance', startDate: '2026-06-01', startTime: '10:00', endDate: '2026-06-01', endTime: '11:00' },
          reason: 'User meminta aksi Calendar write.'
        });
      }
      return JSON.stringify({ intent: 'NONE', confidence: 1, params: {} });
    },
    getSmartAnswer: async () => 'Jawaban fallback governance.',
    safeSendMessage: async () => true,
    sendStreamingAnswer: async () => true,
    pushChatHistory: () => {},
    saveConversationPair: async () => true,
    autoSummarizeMemory: async () => true,
    getSystemPrompt: () => 'Gunakan governance policy.',
    env: { OWNER_CHAT_ID: 'owner_1', ADMIN_SET: new Set(['admin_1']) },
    getCalendarClient: async () => ({
      events: { insert: async () => { calendarInserted = true; return { data: { id: 'event_1' } }; } }
    }),
    parseFlexibleDateTime: (value) => {
      const parsed = new Date(`${String(value).replace(' ', 'T')}:00+07:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    },
    isValidDate: (value) => value instanceof Date && !Number.isNaN(value.getTime())
  };

  beforeEach(() => {
    calendarInserted = false;
  });

  test('low risk intent is allowed', () => {
    const result = governance.reviewDecision('test-trace', {
      userId: 'user_1', userMessage: 'hitung 2+2',
      intent: 'HITUNG', params: { expression: '2+2' },
      nlpConfidence: 0.95, context: {}, botServices: mockServices
    });
    expect(result.executionAllowed).toBe(true);
    expect(result.decision).toBe('ALLOW');
  });

  test('high risk intent is blocked', () => {
    const result = governance.reviewDecision('test-trace', {
      userId: 'user_1', userMessage: 'reset system sekarang',
      intent: 'RESET_SYSTEM', params: {},
      nlpConfidence: 0.95, context: {}, botServices: mockServices
    });
    expect(result.executionAllowed).toBe(false);
  });
});
