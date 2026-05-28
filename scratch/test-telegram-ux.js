'use strict';

const assert = require('assert');
const { formatTelegramMessage } = require('../src/utils/telegram-formatter');
const { splitMessage } = require('../src/utils/message-splitter');
const { sendTelegramMessage } = require('../src/utils/telegram-sender');
const guards = require('../src/interactions/interaction-guards');
const keyboardBuilder = require('../src/interactions/keyboard-builder');

function keyboardLabels(keyboard) {
  return (keyboard?.inline_keyboard || []).flat().map(item => item.text);
}

async function run() {
  const formatted = formatTelegramMessage('### **Hal yang bisa dicoba**\n- **Terima perasaanmu dulu**\n  Izinkan dirimu merasa sedih.');
  assert(!formatted.includes('###'));
  assert(!formatted.includes('**'));
  assert(formatted.includes('<b>Hal yang bisa dicoba</b>'));
  assert(formatted.includes('• <b>Terima perasaanmu dulu</b>'));

  const wellnessType = guards.classifyContext({
    userText: 'Saya ingin mencoba tidur 5 jam selama seminggu',
    answerText: 'Jawaban panjang '.repeat(60)
  });
  assert.strictEqual(wellnessType, 'wellness');
  assert.deepStrictEqual(
    keyboardLabels(keyboardBuilder.nextActionKeyboard({ type: wellnessType })),
    ['Ringkas', 'Tips aman', 'Rencana 7 hari', 'Kapan perlu bantuan']
  );

  const codingType = guards.classifyContext({
    userText: 'Buatkan kode login Next.js dengan Prisma',
    answerText: 'Jawaban panjang '.repeat(60)
  });
  assert.strictEqual(codingType, 'coding');
  assert.deepStrictEqual(
    keyboardLabels(keyboardBuilder.nextActionKeyboard({ type: codingType })),
    ['Buat kode', 'Debug', 'Jelaskan error', 'Struktur folder']
  );

  assert.strictEqual(
    guards.classifyContext({ userText: 'Terima kasih', answerText: 'Sama-sama.' }),
    'none'
  );

  const sent = [];
  const bot = {
    telegramPost: async (_, payload) => {
      sent.push(payload);
      return { data: { ok: true } };
    }
  };

  await sendTelegramMessage(
    bot,
    123,
    'Kalimat panjang. '.repeat(1200),
    {
      reply_markup: keyboardBuilder.nextActionKeyboard({ type: 'general' }),
      delayMs: 0
    }
  );

  assert(sent.length > 1);
  assert(sent[0].text.includes('<b>Bagian 1/'));
  assert(!sent[0].reply_markup);
  assert(sent[sent.length - 1].reply_markup);

  const chunks = splitMessage('A. '.repeat(5000), 3900);
  assert(chunks.length > 1);
  assert(chunks.every(chunk => chunk.length <= 3900));

  console.log('Telegram UX tests passed.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
