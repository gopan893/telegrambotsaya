'use strict';

const assert = require('assert');
const classifier = require('../src/agents/topic-classifier');
const router = require('../src/agents/agent-router');
const bus = require('../src/agents/conversation-bus');

assert.equal(classifier.isShortFollowup('Solusinya apa?'), true);

const context = {
  previousTopics: ['school_life', 'social_advice'],
  previousText: 'Bagaimana caranya menghadapi guru yang sedang marah besar?',
  groupSettings: { mode: 'natural_smart', maxAutoAgents: 5 }
};

const topics = classifier.classifyMessageTopic('Solusinya apa?', context);
assert(topics.includes('school_life'), 'short follow-up should inherit school_life');
assert(topics.includes('social_advice'), 'short follow-up should inherit social_advice');

const route = router.routeMessage('Solusinya apa?', context, {});
assert(route.selectedAgents.includes('reflection'), 'follow-up should select reflection');
assert(!route.selectedAgents.includes('coder'), 'follow-up personal context must not select coder');
assert(!route.selectedAgents.includes('ops'), 'follow-up personal context must not select ops');

(async () => {
  const mem = {};
  const services = {
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    }
  };
  await bus.rememberChatTopic('chat1', 'user1', ['school_life', 'social_advice'], 'guru marah', services);
  const recent = await bus.getRecentChatTopic('chat1', 'user1', services);
  assert.deepEqual(recent.topics, ['school_life', 'social_advice']);
  console.log('test-short-followup-context: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
