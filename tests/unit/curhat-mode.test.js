'use strict';

const curhatMode = require('../../src/conversation/curhat-mode');
const { createConversationManager } = require('../../src/conversation/conversation-manager');

describe('curhat mode', () => {
  test('detects natural curhat intent', () => {
    expect(curhatMode.detectCurhatIntent('saya ingin curhat')).toBe(true);
    expect(curhatMode.detectCurhatIntent('aku lagi sedih banget')).toBe(true);
    expect(curhatMode.detectCurhatIntent('halo')).toBe(false);
  });

  test('detects crisis signal', () => {
    expect(curhatMode.detectCrisisSignal('rasanya mau mengakhiri hidup')).toBe(true);
    expect(curhatMode.detectCrisisSignal('aku mau cerita dulu')).toBe(false);
  });

  test('builds supportive instruction', () => {
    const instruction = curhatMode.buildCurhatInstruction({ crisis: false });
    expect(instruction).toContain('pendengar suportif');
    expect(instruction).toContain('satu pertanyaan lembut');
    expect(instruction).not.toContain('sinyal krisis');
  });

  test('builds crisis-safe instruction', () => {
    const instruction = curhatMode.buildCurhatInstruction({ crisis: true });
    expect(instruction).toContain('sinyal krisis');
    expect(instruction).toContain('layanan darurat lokal');
  });

  test('conversation manager routes curhat as supportive mode', () => {
    const manager = createConversationManager();
    const decision = manager.prepare({
      userId: 'u1',
      chatId: 'c1',
      text: 'saya ingin curhat soal hari ini'
    });

    expect(decision.reason).toBe('curhat_support');
    expect(decision.instruction).toContain('pendengar suportif');
  });
});
