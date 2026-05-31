'use strict';

function parseCommand(text = '') {
  const clean = String(text || '').trim();
  if (!clean.startsWith('/')) return { command: null, args: '' };
  const [rawCommand, ...rest] = clean.split(/\s+/);
  return {
    command: rawCommand.split('@')[0].toLowerCase(),
    args: rest.join(' ').trim()
  };
}

async function routeCommand(command, args, context = {}, msg = {}) {
  if (context.legacyAdapter && typeof context.legacyAdapter.handleCommand === 'function') {
    return context.legacyAdapter.handleCommand(context, msg, command, args);
  }

  const chatId = msg.chat?.id;
  const reply = { reply_to_message_id: msg.message_id };

  if (command === '/start') {
    await context.sendTelegramMessage(context.bot, chatId, 'Halo. Kirim pertanyaan biasa atau gunakan /help untuk daftar perintah.', reply);
    return true;
  }

  if (command === '/help') {
    await context.sendTelegramMessage(context.bot, chatId, 'Command tersedia di runtime legacy. Adapter command belum dikonfigurasi penuh.', reply);
    return true;
  }

  await context.sendTelegramMessage(context.bot, chatId, 'Perintah tidak dikenal. Ketik /help untuk daftar perintah.', reply);
  return true;
}

async function handleCommand(context = {}, msg = {}, text = '') {
  const parsed = parseCommand(text);
  if (!parsed.command) return false;
  return routeCommand(parsed.command, parsed.args, context, msg);
}

module.exports = {
  handleCommand,
  parseCommand,
  routeCommand
};
