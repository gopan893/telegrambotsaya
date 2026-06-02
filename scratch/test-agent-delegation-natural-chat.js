'use strict';

const assert = require('assert');
const agents = require('../src/agents');

function services() {
  const mem = {};
  const sent = [];
  return {
    __agentMemory: mem,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    telegramClient: { sendMessageAsBot: async (botId, chatId, text) => { sent.push({ botId, chatId, text }); return true; } },
    sent
  };
}

(async () => {
  const svc = services();
  const routePhase = agents.agentRouter.routeMessage('buat prompt phase 24 external integration', {}, svc);
  assert.strictEqual(agents.delegationEngine.shouldTriggerDelegation('buat prompt phase 24 external integration', {}, routePhase, {}, svc).needed, true);
  const session = await agents.delegationEngine.createDelegationSession({
    workspaceId: 'default',
    userId: 'u1',
    chatId: '-100',
    originalMessage: 'buat prompt phase 24 external integration'
  }, svc);
  await agents.delegationEngine.planDelegation(session.id, svc);
  const result = await agents.delegationEngine.runDelegation(session.id, svc);
  assert.ok(/Phase 24|external|scope/i.test(result.finalAnswer));
  assert.ok(!/Smart Agent Router|Mode:|#visual-analysis|API Vision belum dikonfigurasi/i.test(result.finalAnswer));

  const deployRoute = agents.agentRouter.routeMessage('bot error deploy Render', {}, svc);
  assert.strictEqual(agents.delegationEngine.shouldTriggerDelegation('bot error deploy Render', {}, deployRoute, {}, svc).needed, true);
  assert.strictEqual(agents.delegationEngine.shouldTriggerDelegation('saya capek hari ini', {}, agents.agentRouter.routeMessage('saya capek hari ini', {}, svc), {}, svc).needed, false);
  const restoreRoute = agents.agentRouter.routeMessage('saya ingin restore backup lama', {}, svc);
  assert.strictEqual(agents.delegationEngine.shouldTriggerDelegation('saya ingin restore backup lama', {}, restoreRoute, {}, svc).needed, true);

  await agents.conversationBus.setGroupSettings('-100', {
    mode: 'natural_smart',
    multiBotVisibleReplies: true,
    visibleSpecialistReplies: 'selected',
    maxVisibleSpecialistBots: 2
  }, svc);
  const event = agents.conversationBus.createConversationEvent({
    message: { text: 'buat prompt phase 24 external integration', chat: { id: '-100', type: 'group' }, from: { id: 'u1', is_bot: false } }
  }, {}, svc);
  const drafts = await agents.conversationBus.collectAgentDrafts(event, routePhase, svc);
  await agents.conversationBus.sendAgentResponses(event, routePhase, drafts, svc);
  assert.ok(svc.sent.length <= 3, 'visible multi-bot should not send all agents');

  console.log('test-agent-delegation-natural-chat: ok');
})();
