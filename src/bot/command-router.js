'use strict';

const telegramUx = require('../telegram-ux');
const telegramCenter = require('../telegram-center');
const telegramRouter = require('../telegram-router');

const MENU_COMMANDS = new Set(['menu', 'status', 'project', 'coding', 'agents', 'memory', 'workflow', 'devices', 'approval', 'settings']);

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
  const cleanCmd = command.replace(/^\//, '');
  const chatId = msg.chat?.id;
  const reply = { reply_to_message_id: msg.message_id };

  if (cleanCmd === 'start') {
    const rendered = telegramUx.telegramMessageRenderer.renderTelegramReply('Halo! Kirim pertanyaan biasa atau gunakan /menu untuk melihat perintah.');
    await sendSafe(context, chatId, rendered, reply);
    return true;
  }

  if (MENU_COMMANDS.has(cleanCmd)) {
    const actor = { isOwner: Boolean(context.config && String(context.config.OWNER_CHAT_ID) === String(msg.from?.id)), isAdmin: false, isGroup: msg.chat?.type === 'group' || msg.chat?.type === 'supergroup' };
    const rendered = telegramCenter.telegramMenuRenderer.renderMenuByMenuId(cleanCmd, actor, context.data);
    await sendSafe(context, chatId, { parts: [rendered.text], keyboard: rendered.keyboard }, reply);
    return true;
  }

  if (cleanCmd === 'help' || cleanCmd === 'bantuan') {
    const actor = { isOwner: Boolean(context.config && String(context.config.OWNER_CHAT_ID) === String(msg.from?.id)), isAdmin: false, isGroup: msg.chat?.type === 'group' || msg.chat?.type === 'supergroup' };
    const helpText = telegramCenter.telegramCommandHelp.buildGeneralHelp(actor);
    const rendered = telegramUx.telegramMessageRenderer.renderTelegramReply(helpText);
    await sendSafe(context, chatId, rendered, reply);
    return true;
  }

  if (context.legacyAdapter && typeof context.legacyAdapter.handleCommand === 'function') {
    return context.legacyAdapter.handleCommand(context, msg, command, args);
  }

  const unknownRendered = telegramUx.telegramMessageRenderer.renderTelegramReply('Perintah tidak dikenal. Ketik /menu untuk melihat daftar perintah.');
  await sendSafe(context, chatId, unknownRendered, reply);
  return true;
}

async function sendSafe(context, chatId, rendered, reply) {
  const parts = rendered.parts || [rendered.text || ''];
  const keyboard = rendered.keyboard || null;
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    const options = {
      reply_to_message_id: reply?.reply_to_message_id,
      parse_mode: 'HTML'
    };
    if (isLast && keyboard) options.reply_markup = keyboard;
    if (typeof context.sendTelegramMessage === 'function') {
      await context.sendTelegramMessage(context.bot, chatId, parts[i], options);
    }
  }
}

async function handleCommand(context = {}, msg = {}, text = '') {
  const parsed = parseCommand(text);
  if (!parsed.command) return false;
  return routeCommand(parsed.command, parsed.args, context, msg);
}

module.exports = {
  handleCommand,
  parseCommand,
  routeCommand,
  sendSafe,
  MENU_COMMANDS
};
