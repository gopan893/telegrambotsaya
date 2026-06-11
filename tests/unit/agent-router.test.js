'use strict';

const agents = require('../../src/agents');
const multibot = require('../../src/multibot');

const services = {
  env: { TELEGRAM_TOKEN: 'legacy-token' },
  botRegistry: multibot.botRegistry,
  __agentMemory: {}
};

beforeAll(() => {
  multibot.botRegistry.loadBotConfigs(services.env);
});

function selected(text, forceMode) {
  return agents.agentRouter.routeMessage(text, {
    forceMode,
    groupSettings: { mode: forceMode || 'natural_smart', maxAutoAgents: 3 }
  }, services);
}

function hasAll(route, ids) {
  for (const id of ids) {
    expect(route.selectedAgents).toContain(id);
  }
}

function hasNone(route, ids) {
  for (const id of ids) {
    expect(route.selectedAgents).not.toContain(id);
  }
}

describe('Agent Router', () => {
  test('confused user gets orchestrator, planner, critic', () => {
    hasAll(selected('Saya bingung lanjut phase berapa'), ['orchestrator', 'planner', 'critic']);
  });

  test('deploy error gets ops and coder', () => {
    hasAll(selected('Bot saya error setelah deploy di Render'), ['orchestrator', 'ops', 'coder']);
  });

  test('backup restore gets security, executor, ops', () => {
    hasAll(selected('Saya ingin restore backup lama'), ['orchestrator', 'security', 'executor', 'ops']);
  });

  test('emotional message gets reflection, not coder', () => {
    hasAll(selected('Saya capek hari ini'), ['orchestrator', 'reflection']);
    hasNone(selected('Saya capek hari ini'), ['coder']);
  });

  test('dashboard improvement gets planner, coder, critic', () => {
    hasAll(selected('Tolong buat rencana memperbaiki dashboard'), ['orchestrator', 'planner', 'coder', 'critic']);
  });

  test('API research gets research agent', () => {
    hasAll(selected('Cari API vision gratis'), ['orchestrator', 'research', 'coder']);
  });

  test('backup execution requires approval', () => {
    const backupRun = selected('Saya ingin menjalankan backup sekarang');
    hasAll(backupRun, ['orchestrator', 'executor', 'security', 'ops']);
    expect(backupRun.approvalRequired).toBe(true);
  });

  test('simple greeting returns only orchestrator', () => {
    expect(selected('Halo').selectedAgents).toEqual(['orchestrator']);
  });

  test('secret detected is routed to security', () => {
    const secret = selected('ini token=abc123456789 dan jangan bocor');
    hasAll(secret, ['orchestrator', 'security']);
    expect(secret.risk.secretDetected).toBe(true);
    expect(JSON.stringify(secret)).not.toContain('abc123456789');
  });

  test('debug reply renders correctly', () => {
    const debug = agents.agentResponseRenderer.renderDebugRouterReply(selected('saya bingung lanjut phase berapa'));
    expect(debug).toContain('Smart Agent Router');
    expect(debug).toContain('Mode:');
    expect(debug).toContain('Agent:');
  });
});
