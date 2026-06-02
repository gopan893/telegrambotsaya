'use strict';

const assert = require('assert');
const axios = require('axios');
const agents = require('../src/agents');
const multibot = require('../src/multibot');

function createServices() {
  const sent = [];
  const env = {
    TELEGRAM_TOKEN: 'default-token',
    TELEGRAM_TOKEN_PLANNER: 'planner-token',
    TELEGRAM_TOKEN_CODER: 'coder-token',
    TELEGRAM_TOKEN_CRITIC: 'critic-token',
    TELEGRAM_TOKEN_PLANNE: 'typo-token'
  };
  return {
    env,
    botRegistry: multibot.botRegistry,
    __agentMemory: {},
    telegramClient: {
      sendMessageAsBot: async (botId, chatId, text) => {
        sent.push({ botId, chatId, text });
        return { ok: true };
      }
    },
    safeSendMessage: async (chatId, text) => {
      sent.push({ botId: 'default', chatId, text });
      return true;
    },
    sent
  };
}

(async () => {
  const services = createServices();
  multibot.botRegistry.loadBotConfigs(services.env);
  const warnings = multibot.botRegistry.detectConfigWarnings(services.env);
  assert.ok(warnings.some(item => /TELEGRAM_TOKEN_PLANNE/.test(item.message)), 'typo warning required');

  const event = agents.conversationBus.createConversationEvent({
    message: {
      message_id: 1,
      text: 'saya bingung lanjut phase berapa',
      chat: { id: '-1001', type: 'group' },
      from: { id: 'u1', is_bot: false }
    }
  }, {}, services);

  await agents.conversationBus.setGroupSettings('-1001', {
    mode: 'natural_smart',
    multiBotVisibleReplies: true,
    visibleSpecialistReplies: 'selected',
    maxVisibleSpecialistBots: 2
  }, services);
  const routed = await agents.conversationBus.routeConversationEvent(event, services);
  const drafts = await agents.conversationBus.collectAgentDrafts(event, routed.route, services);
  const result = await agents.conversationBus.sendAgentResponses(event, routed.route, drafts, services);
  assert.ok(result.sent >= 2, 'orchestrator plus visible specialist expected');
  assert.ok(services.sent.some(item => item.botId === 'planner'), 'planner response should use planner bot');
  assert.ok(services.sent.some(item => item.botId === 'critic'), 'critic response should use critic bot');
  assert.ok(!services.sent.some(item => /#visual-analysis|Sumber file:|API Vision belum dikonfigurasi/i.test(item.text)), 'specialist replies must be sanitized');

  services.sent.length = 0;
  await agents.conversationBus.setGroupSettings('-1001', {
    mode: 'quiet',
    multiBotVisibleReplies: true,
    visibleSpecialistReplies: 'selected',
    maxVisibleSpecialistBots: 2
  }, services);
  const quiet = await agents.conversationBus.routeConversationEvent(event, services);
  await agents.conversationBus.sendAgentResponses(event, quiet.route, await agents.conversationBus.collectAgentDrafts(event, quiet.route, services), services);
  assert.strictEqual(services.sent.length, 1, 'quiet mode should only send orchestrator');

  services.sent.length = 0;
  await agents.conversationBus.setGroupSettings('-1001', {
    mode: 'natural_smart',
    multiBotVisibleReplies: true,
    visibleSpecialistReplies: 'selected',
    maxVisibleSpecialistBots: 1
  }, services);
  const routedLimited = await agents.conversationBus.routeConversationEvent(event, services);
  await agents.conversationBus.sendAgentResponses(event, routedLimited.route, await agents.conversationBus.collectAgentDrafts(event, routedLimited.route, services), services);
  assert.ok(services.sent.filter(item => item.botId !== 'default').length <= 1, 'maxVisibleSpecialistBots enforced');

  services.sent.length = 0;
  const schoolEvent = agents.conversationBus.createConversationEvent({
    message: {
      message_id: 2,
      text: 'Aku dimarahin guru karena telat',
      chat: { id: '-1001', type: 'group' },
      from: { id: 'u1', is_bot: false }
    }
  }, {}, services);
  await agents.conversationBus.setGroupSettings('-1001', {
    mode: 'natural_smart',
    multiBotVisibleReplies: true,
    visibleSpecialistReplies: 'selected',
    maxVisibleSpecialistBots: 2
  }, services);
  const schoolRoute = await agents.conversationBus.routeConversationEvent(schoolEvent, services);
  assert.ok(schoolRoute.route.selectedAgents.includes('reflection'), 'personal/school route should select reflection');
  assert.ok(!schoolRoute.route.selectedAgents.includes('coder'), 'coder must stay silent for school advice');
  await agents.conversationBus.sendAgentResponses(schoolEvent, schoolRoute.route, await agents.conversationBus.collectAgentDrafts(schoolEvent, schoolRoute.route, services), services);
  assert.ok(!services.sent.some(item => item.botId === 'coder'), 'coder bot should not reply to school advice');
  assert.ok(!services.sent.some(item => /teknis|regresi|deploy|debug/i.test(item.text)), 'school advice must not leak technical text');

  const botMessage = agents.conversationBus.createConversationEvent({
    message: {
      text: 'bot loop',
      chat: { id: '-1001', type: 'group' },
      from: { id: 'b1', is_bot: true }
    }
  }, {}, services);
  assert.strictEqual((await agents.conversationBus.routeConversationEvent(botMessage, services)).ok, false, 'bot messages ignored');

  const safe = multibot.botRegistry.listBotConfigsSafe(services.env);
  assert.ok(!JSON.stringify(safe).includes('planner-token'), 'safe bot mapping must not leak token');

  const calls = [];
  const originalPost = axios.post;
  axios.post = async (url, payload) => {
    calls.push({ url, payload });
    return { data: { ok: true, result: { message_id: 1 } } };
  };
  try {
    await multibot.telegramClient.sendMessageAsBot('planner', '-1001', 'Planner hello', {}, { env: services.env });
    assert.ok(calls[0].url.includes('/botplanner-token/sendMessage'), 'telegram client should use selected bot token URL internally');
  } finally {
    axios.post = originalPost;
  }

  console.log('test-visible-multibot-replies: ok');
})();
