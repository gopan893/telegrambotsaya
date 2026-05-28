'use strict';

const assert = require('assert');
const interactions = require('../src/interactions');

async function main() {
  interactions.configure({ redisClient: null });

  const coding = await interactions.manager.buildInteractiveResponse({
    userId: 'u1',
    chatId: 'c1',
    userText: 'Tolong buat fitur login Next.js',
    answerText: 'Kita bisa pakai JWT, session, NextAuth, atau Supabase Auth.'
  });
  assert.equal(coding.type, 'coding');
  assert.ok(coding.reply_markup.inline_keyboard.length > 0);

  const state = await interactions.state.getInteraction('u1');
  assert.equal(state.type, 'coding');
  assert.ok(state.userText.includes('login'));

  const simple = await interactions.manager.buildInteractiveResponse({
    userId: 'u2',
    chatId: 'c2',
    userText: 'Halo',
    answerText: 'Halo, ada yang bisa saya bantu?'
  });
  assert.equal(simple.type, 'none');
  assert.equal(simple.reply_markup, null);

  const parsed = interactions.callbackRouter.parseCallbackData('ix:learn:roadmap');
  assert.deepEqual(parsed, {
    raw: 'ix:learn:roadmap',
    namespace: 'ix',
    group: 'learn',
    action: 'roadmap',
    id: ''
  });

  const keyboard = interactions.keyboardBuilder.mainMenuKeyboard();
  const allButtons = keyboard.inline_keyboard.flat();
  assert.ok(allButtons.every(item => item.callback_data.length <= 64));

  await interactions.state.clearInteraction('u1');
  assert.equal(await interactions.state.getInteraction('u1'), null);

  console.log('interaction layer ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
