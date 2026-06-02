'use strict';

const assert = require('assert');
const agents = require('../src/agents');

function createServices() {
  const mem = {};
  return {
    __agentMemory: mem,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => {
        mem[key] = value;
        return value;
      }
    },
    actorId: 'u1',
    userId: 'u1',
    workspaceId: 'ws1'
  };
}

(async () => {
  const services = createServices();
  await agents.agentMemoryStore.createAgentMemory({
    agentId: 'coder',
    workspaceId: 'ws1',
    userId: 'u1',
    type: 'technical_pattern',
    title: 'Render CommonJS',
    content: 'Project memakai CommonJS dan harus cocok untuk Render free tier.',
    tags: ['render', 'commonjs']
  }, services);
  await agents.learningNotes.createLearningNote({
    agentId: 'coder',
    workspaceId: 'ws1',
    userId: 'u1',
    content: 'User lebih suka solusi langsung dan production-ready.'
  }, services);

  const prompt = await agents.agentPromptComposer.composeAgentFinalPrompt('coder', 'Fix deploy Render CommonJS bot saya', {
    workspaceId: 'ws1',
    userId: 'u1',
    topics: ['coding', 'deploy'],
    riskLevel: 'medium'
  }, services);

  assert.ok(prompt.finalPrompt.includes('Coder Agent'));
  assert.ok(prompt.finalPrompt.includes('CommonJS'));
  assert.ok(prompt.selectedMemories.length >= 1);
  assert.ok(!/api_key=|postgresql:\/\//i.test(prompt.finalPrompt));

  console.log('test-agent-prompt-composer: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
