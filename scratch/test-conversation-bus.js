'use strict';

const assert = require('assert');
const agents = require('../src/agents');
const multibot = require('../src/multibot');

function createServices() {
  const db = {};
  const sent = [];
  return {
    env: { TELEGRAM_TOKEN: 'legacy-token' },
    botRegistry: multibot.botRegistry,
    telegramClient: {
      sendMessageAsBot: async (botId, chatId, text) => {
        sent.push({ botId, chatId, text });
        return { ok: true };
      }
    },
    __agentMemory: db,
    safeSendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
      return true;
    },
    sent
  };
}

(async () => {
  const services = createServices();
  multibot.botRegistry.loadBotConfigs(services.env);

  const update = {
    update_id: 1,
    message: {
      message_id: 10,
      text: 'Bot saya error setelah deploy di Render',
      chat: { id: 'chat1', type: 'group' },
      from: { id: 'user1', is_bot: false }
    }
  };
  const event = agents.conversationBus.createConversationEvent(update, {}, services);
  assert.equal(await agents.conversationBus.preventDuplicateReplies(event, services), true);
  assert.equal(await agents.conversationBus.preventDuplicateReplies(event, services), false);

  await agents.conversationBus.setGroupSettings('chat1', { mode: 'quiet', maxAutoAgents: 1 }, services);
  const quiet = await agents.conversationBus.routeConversationEvent(event, services);
  assert.deepEqual(quiet.route.selectedAgents, ['orchestrator']);

  await agents.conversationBus.setGroupSettings('chat1', { mode: 'natural_smart', maxAutoAgents: 3 }, services);
  const smart = await agents.conversationBus.routeConversationEvent(event, services);
  assert.ok(smart.route.selectedAgents.includes('ops'));
  assert.ok(smart.route.selectedAgents.includes('coder'));
  assert.ok(smart.route.selectedAgents.length <= 3);

  const drafts = await agents.conversationBus.collectAgentDrafts(event, smart.route, services);
  const order = drafts.filter(d => smart.route.selectedAgents.includes(d.agentId)).map(d => d.agentId);
  assert.equal(order[0], 'orchestrator');
  const sentResult = await agents.conversationBus.sendAgentResponses(event, smart.route, drafts, services);
  assert.equal(sentResult.sent, 1);
  assert.ok(services.sent[0].text);
  assert.ok(!/Smart Agent Router/i.test(services.sent[0].text));
  assert.ok(!/Mode:/i.test(services.sent[0].text));
  assert.ok(!/^Agent:/im.test(services.sent[0].text));
  assert.ok(!/Saya bertindak sebagai/i.test(services.sent[0].text));

  const emotionalEvent = agents.conversationBus.createConversationEvent({
    message: {
      message_id: 11,
      text: 'Saya capek hari ini',
      chat: { id: 'chat1', type: 'group' },
      from: { id: 'user1', is_bot: false }
    }
  }, {}, services);
  const emotional = await agents.conversationBus.routeConversationEvent(emotionalEvent, services);
  assert.ok(emotional.route.selectedAgents.includes('reflection'));
  assert.ok(!emotional.route.selectedAgents.includes('coder'));

  const botEvent = agents.conversationBus.createConversationEvent({
    message: {
      text: 'loop',
      chat: { id: 'chat1', type: 'group' },
      from: { id: 'bot1', is_bot: true }
    }
  }, {}, services);
  const ignored = await agents.conversationBus.routeConversationEvent(botEvent, services);
  assert.equal(ignored.ok, false);

  const action = await agents.conversationBus.routeConversationEvent(agents.conversationBus.createConversationEvent({
    message: {
      message_id: 12,
      text: 'Saya ingin menjalankan backup sekarang',
      chat: { id: 'chat1', type: 'group' },
      from: { id: 'user1', is_bot: false }
    }
  }, {}, services), services);
  assert.equal(action.route.approvalRequired, true);
  assert.ok(action.route.selectedAgents.includes('executor'));

  console.log('test-conversation-bus: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
