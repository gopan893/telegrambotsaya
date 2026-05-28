'use strict';

const assert = require('assert');
const { createConversationManager } = require('../src/conversation');
const followup = require('../src/conversation/followup-detector');
const topicShift = require('../src/conversation/topic-shift-detector');

const manager = createConversationManager();
const userId = 'u1';
const chatId = 'c1';

let decision = manager.prepare({
  userId,
  chatId,
  text: 'Tolong bantu',
  command: null
});
assert.strictEqual(decision.action, 'normal');

const pending = manager.recordBotReply({
  userId,
  chatId,
  userText: 'Tolong bantu',
  botText: 'Mau aku bantu cari info Xiaomi 14?',
  intent: 'assistant_reply'
});
assert(pending, 'bot yes/no question should create pending action');
assert.strictEqual(pending.type, 'search_confirmation');
assert(/xiaomi/i.test(pending.topic));

decision = manager.prepare({
  userId,
  chatId,
  text: 'Iya',
  command: null
});
assert.strictEqual(decision.action, 'continue');
assert(/afirmatif/i.test(decision.instruction));
assert(/Xiaomi/i.test(decision.promptContext));

manager.recordBotReply({
  userId,
  chatId,
  userText: 'Iya',
  botText: 'Baik, berikut ringkasan Xiaomi 14.',
  intent: 'assistant_reply'
});

manager.recordBotReply({
  userId,
  chatId,
  userText: 'Mau bahas laptop?',
  botText: 'Mau aku lanjutkan bahas laptop kerja?',
  intent: 'assistant_reply'
});

decision = manager.prepare({
  userId,
  chatId,
  text: 'Buatkan kode login Next.js',
  command: null
});
assert.strictEqual(decision.action, 'normal');
assert(decision.reason.startsWith('topic_shift'));

const cleanManager = createConversationManager();
decision = cleanManager.prepare({
  userId: 'u2',
  chatId: 'c2',
  text: 'iya',
  command: null
});
assert.strictEqual(decision.action, 'normal', 'affirmative without pending should stay normal chat');

const genericQuestionManager = createConversationManager();
const genericPending = genericQuestionManager.recordBotReply({
  userId: 'u4',
  chatId: 'c4',
  userText: 'Halo',
  botText: 'Apa yang ingin kamu bahas hari ini?',
  intent: 'assistant_reply'
});
assert.strictEqual(genericPending, null, 'open-ended bot question should not create pending action');

decision = cleanManager.prepare({
  userId: 'u3',
  chatId: 'c3',
  text: 'lanjut',
  command: null
});
assert.strictEqual(decision.action, 'direct');
assert(/bagian/i.test(decision.responseText));

assert.strictEqual(followup.detect('boleh').kind, 'affirm');
assert.strictEqual(followup.detect('tidak').kind, 'deny');
assert.strictEqual(followup.detect('lanjutkan').kind, 'continue');

const shift = topicShift.detectTopicShift({
  text: 'Buatkan kode login Next.js',
  pending: {
    topic: 'Xiaomi 14',
    query: 'Xiaomi 14',
    payload: {}
  },
  context: {}
});
assert.strictEqual(shift.shifted, true);

console.log('Conversation layer checks passed.');
