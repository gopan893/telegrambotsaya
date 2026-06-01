'use strict';

const assert = require('assert');
const agents = require('../src/agents');
const multibot = require('../src/multibot');

const services = {
  env: { TELEGRAM_TOKEN: 'legacy-token' },
  botRegistry: multibot.botRegistry,
  __agentMemory: {}
};
multibot.botRegistry.loadBotConfigs(services.env);

function selected(text, forceMode) {
  return agents.agentRouter.routeMessage(text, {
    forceMode,
    groupSettings: { mode: forceMode || 'natural_smart', maxAutoAgents: 3 }
  }, services);
}

function hasAll(route, ids) {
  for (const id of ids) {
    assert.ok(route.selectedAgents.includes(id), `${id} missing from ${JSON.stringify(route.selectedAgents)}`);
  }
}

hasAll(selected('Saya bingung lanjut phase berapa'), ['orchestrator', 'planner', 'critic']);
hasAll(selected('Bot saya error setelah deploy di Render'), ['orchestrator', 'ops', 'coder']);
hasAll(selected('Saya ingin restore backup lama'), ['orchestrator', 'security', 'executor', 'ops']);
hasAll(selected('Saya capek hari ini'), ['orchestrator', 'reflection']);
assert.ok(!selected('Saya capek hari ini').selectedAgents.includes('coder'));
hasAll(selected('Tolong buat rencana memperbaiki dashboard'), ['orchestrator', 'planner', 'coder', 'critic']);
hasAll(selected('Cari API vision gratis'), ['orchestrator', 'research', 'coder']);
const backupRun = selected('Saya ingin menjalankan backup sekarang');
hasAll(backupRun, ['orchestrator', 'executor', 'security', 'ops']);
assert.equal(backupRun.approvalRequired, true);

assert.deepEqual(selected('Halo').selectedAgents, ['orchestrator']);
hasAll(selected('Buatkan kode Express middleware'), ['orchestrator', 'coder']);
hasAll(selected('Roadmap AI bot saya terlalu banyak fitur'), ['orchestrator', 'planner', 'critic']);
const secret = selected('ini token=abc123456789 dan jangan bocor');
hasAll(secret, ['orchestrator', 'security']);
assert.equal(secret.risk.secretDetected, true);
assert.ok(!JSON.stringify(secret).includes('abc123456789'));

hasAll(selected('/council Phase 20 multi-bot'), ['orchestrator', 'planner', 'coder', 'critic', 'security']);
hasAll(selected('/debate roadmap'), ['orchestrator', 'planner', 'critic']);
const all = selected('/allagents test');
assert.ok(all.selectedAgents.length >= 8);
assert.ok(all.selectedAgents.includes('executor'));

assert.ok(selected('Halo').selectedAgents.length <= 3);

console.log('test-agent-router: ok');
