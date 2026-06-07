'use strict';

const assert = require('assert');
const normalizer = require('../src/telegram-control/telegram-update-normalizer');

function run() {
  const textUpdate = {
    update_id: 1,
    message: {
      message_id: 10,
      date: 1700000000,
      text: '/telegramcheck hello',
      chat: { id: 123, type: 'private' },
      from: { id: 456, username: 'afan', first_name: 'Afan' },
      entities: [{ type: 'bot_command', offset: 0, length: 14 }]
    }
  };
  const n1 = normalizer.normalizeTelegramUpdate(textUpdate, { botId: 'default' });
  assert.strictEqual(n1.text, '/telegramcheck hello');
  assert.strictEqual(n1.command, 'telegramcheck');
  assert.strictEqual(n1.args, 'hello');
  assert.strictEqual(n1.isCommand, true);
  assert.strictEqual(n1.botId, 'default');

  const captionUpdate = {
    update_id: 2,
    message: {
      message_id: 11,
      caption: 'analisis gambar ini',
      photo: [{ file_id: 'photo_1' }],
      chat: { id: 123, type: 'private' },
      from: { id: 456 }
    }
  };
  const n2 = normalizer.normalizeTelegramUpdate(captionUpdate);
  assert.strictEqual(n2.text, 'analisis gambar ini');
  assert.strictEqual(n2.messageType, 'photo');
  assert.strictEqual(n2.hasAttachment, true);

  const edited = normalizer.normalizeTelegramUpdate({
    update_id: 3,
    edited_message: {
      message_id: 12,
      text: 'edited text',
      chat: { id: 123, type: 'private' },
      from: { id: 456 }
    }
  });
  assert.strictEqual(edited.rawType, 'edited_message');
  assert.strictEqual(edited.text, 'edited text');

  const callback = normalizer.normalizeTelegramUpdate({
    update_id: 4,
    callback_query: {
      id: 'cb1',
      data: '/messagecheck',
      from: { id: 456, is_bot: false },
      message: { message_id: 13, chat: { id: 123, type: 'private' } }
    }
  });
  assert.strictEqual(callback.messageType, 'callback');
  assert.strictEqual(callback.text, '/messagecheck');
  assert.strictEqual(callback.command, 'messagecheck');
  assert.strictEqual(callback.isBotMessage, false);

  const reply = normalizer.normalizeTelegramUpdate({
    update_id: 5,
    message: {
      message_id: 14,
      text: 'solusinya apa?',
      chat: { id: 123, type: 'private' },
      from: { id: 456 },
      reply_to_message: { message_id: 9, text: 'guru sedang marah', from: { id: 789 } }
    }
  });
  assert.strictEqual(reply.isReply, true);
  assert.strictEqual(reply.replyToMessageId, 9);
  assert.strictEqual(reply.reply.replyText, 'guru sedang marah');

  console.log('PASS test-telegram-update-normalizer');
}

run();
