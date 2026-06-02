'use strict';

const assert = require('assert');
const agents = require('../src/agents');

function createServices() {
  const mem = {};
  const audit = [];
  return {
    __agentMemory: mem,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => {
        mem[key] = value;
        return value;
      }
    },
    auditLog: {
      recordAuditLog: async (entry) => audit.push(entry)
    },
    __audit: audit,
    actorId: 'u1',
    userId: 'u1',
    workspaceId: 'ws1'
  };
}

(async () => {
  const services = createServices();
  const memory = await agents.agentMemoryStore.createAgentMemory({
    agentId: 'coder',
    workspaceId: 'ws1',
    userId: 'u1',
    type: 'technical_pattern',
    content: 'Coder Agent harus menjaga Node.js 20 CommonJS dan Render compatibility.',
    tags: ['nodejs', 'render']
  }, services);
  assert.ok(memory.id);

  const list = await agents.agentMemoryStore.listAgentMemories({ agentId: 'coder', workspaceId: 'ws1', userId: 'u1' }, services);
  assert.ok(list.some(item => item.id === memory.id));

  const archived = await agents.agentMemoryStore.archiveAgentMemory(memory.id, { userId: 'u1' }, services);
  assert.ok(archived.archivedAt);
  const afterArchive = await agents.agentMemoryStore.listAgentMemories({ agentId: 'coder', workspaceId: 'ws1', userId: 'u1' }, services);
  assert.ok(!afterArchive.some(item => item.id === memory.id));

  const restored = await agents.agentMemoryStore.restoreAgentMemory(memory.id, { userId: 'u1' }, services);
  assert.equal(restored.archivedAt, null);

  let rejected = false;
  try {
    await agents.agentMemoryStore.createAgentMemory({
      agentId: 'security',
      workspaceId: 'ws1',
      userId: 'u1',
      content: 'api_key=super-secret-value'
    }, services);
  } catch (err) {
    rejected = err.code === 'AGENT_MEMORY_SECRET_REJECTED';
  }
  assert.equal(rejected, true);
  assert.ok(services.__audit.some(entry => entry.action === 'agents/memory_created'));

  console.log('test-agent-memory-store: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
