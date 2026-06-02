'use strict';

const assert = require('assert');
const agents = require('../src/agents');

(async () => {
  const services = { __agentMemory: {} };
  const coder = agents.agentPersonality.getDefaultAgentProfile('coder');
  assert.equal(coder.agentId, 'coder');
  assert.ok(coder.responseStyle);
  assert.ok(coder.memoryPolicy.enabled);
  assert.ok(coder.safetyRules.some(rule => /token|secret/i.test(rule)));

  const profile = await agents.agentProfileStore.getAgentProfile('security', services);
  assert.equal(profile.agentId, 'security');
  assert.equal(profile.agentMemoryEnabled, true);

  const updated = await agents.agentProfileStore.updateAgentProfile('planner', {
    responseStyle: { tone: 'sangat praktis' },
    preferences: { maxPlanSteps: 3 }
  }, { userId: 'u1', workspaceId: 'ws1' }, { ...services, workspaceId: 'ws1' });
  assert.equal(updated.responseStyle.tone, 'sangat praktis');
  assert.equal(updated.preferences.maxPlanSteps, 3);

  const list = agents.agentRegistry.listAgents({}, services);
  assert.ok(list.find(agent => agent.id === 'coder').memoryPolicy);
  assert.ok(list.find(agent => agent.id === 'reflection').responseStyle);

  console.log('test-agent-personality: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
