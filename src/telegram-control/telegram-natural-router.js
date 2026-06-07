'use strict';

const intentClassifier = require('./telegram-intent-classifier');
const registry = require('./telegram-command-registry');
const riskClassifier = require('./telegram-risk-classifier');
const utils = require('./telegram-utils');

function routeTelegramNaturalMessage(message, context) {
  if (!message) {
    return { handled: false, intent: 'unknown', response: 'Pesan kosong.' };
  }

  const text = utils.getMessageText(message) || '';
  const chatId = utils.getChatId(message);

  if (utils.isBotMessage(message)) {
    return { handled: false, intent: 'bot_message', response: null };
  }

  const classification = intentClassifier.classifyTelegramIntent(text, context);

  if (classification.blocked || classification.intent === 'contains_secret') {
    return { handled: true, intent: 'contains_secret', blocked: true, response: '⚠️ Pesan mengandung pola rahasia. Tidak akan diproses atau disimpan.', command: null };
  }

  if (classification.intent === 'slash_command' && classification.command) {
    const cmd = registry.getTelegramCommand(classification.command);
    if (cmd) {
      const risk = riskClassifier.classifyTelegramCommandRisk(cmd);
      return {
        handled: true,
        intent: 'slash_command',
        command: cmd,
        commandName: classification.command,
        risk,
        classification,
        rawText: text,
        chatId
      };
    }
    return {
      handled: true,
      intent: 'slash_command',
      command: null,
      commandName: classification.command,
      response: `Perintah /${classification.command} tidak dikenali. Gunakan /menu untuk melihat daftar perintah.`,
      rawText: text,
      chatId
    };
  }

  const intentResult = classifyTelegramIntent(text, context);
  const matchedCommand = intentResult.command ? registry.getTelegramCommand(intentResult.command) : null;
  const risk = intentResult.command ? riskClassifier.classifyTelegramCommandRisk({ riskLevel: 'read_only', name: intentResult.command }) : riskClassifier.classifyTelegramNaturalRisk(intentResult);

  if (intentResult.intent === 'refuse_full_auto') {
    return {
      handled: true,
      intent: 'refuse_full_auto',
      command: null,
      response: '⚠️ Saya tidak bisa menyelesaikan semua secara otomatis.\n\nSaya bisa membantu dengan:\n• Membuat rencana bertahap\n• Menyarankan tindakan berikutnya\n• Membuat proposal untuk setiap langkah\n\nGunakan perintah spesifik atau /help untuk memulai.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'greeting') {
    return {
      handled: true,
      intent: 'greeting',
      command: null,
      response: 'Halo! Ada yang bisa saya bantu? Gunakan /menu untuk melihat perintah yang tersedia.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'thanks') {
    return {
      handled: true,
      intent: 'thanks',
      command: null,
      response: 'Sama-sama! Senang bisa membantu. 😊',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'followup_answer') {
    return {
      handled: true,
      intent: 'followup_answer',
      command: null,
      response: null,
      isFollowup: true,
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'operating_loop_run') {
    return {
      handled: true,
      intent: 'operating_loop_run',
      command: null,
      response: '⚠️ Saya dapat menjalankan operating loop yang sudah dikonfigurasi.\n\nLoop yang tersedia:\n• Daily AI OS Briefing\n• Project Operator Review\n• Portfolio Priority Review\n• Production Health Review\n• Incident Review\n• Cost & Budget Review\n• Pending Approval Review\n• Knowledge & Memory Review\n• LifeOS Daily Review\n• Weekly Strategy Review\n\nGunakan /runloop <loopId> untuk menjalankan loop tertentu, atau /loopstatus untuk melihat status.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'aios_daily_briefing') {
    return {
      handled: true,
      intent: 'aios_daily_briefing',
      command: null,
      response: '📋 Saya akan menyiapkan ringkasan AI OS harian.\n\nGunakan /dailyaios untuk melihat laporan harian, atau /loopreport untuk laporan operating loop.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'what_next_action') {
    return {
      handled: true,
      intent: 'what_next_action',
      command: null,
      response: '💡 Berdasarkan analisis sistem:\n\nGunakan /nextaction untuk melihat rekomendasi tindakan berikutnya yang spesifik dari sistem operator.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'what_blockers') {
    return {
      handled: true,
      intent: 'what_blockers',
      command: null,
      response: '🚨 Gunakan /blockers untuk melihat daftar blocker saat ini yang memerlukan perhatian.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'what_pending_proposals') {
    return {
      handled: true,
      intent: 'what_pending_proposals',
      command: null,
      response: '📋 Gunakan /pendingdigest untuk melihat proposal yang menunggu persetujuan.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'enable_daily_loop') {
    return {
      handled: true,
      intent: 'enable_daily_loop',
      command: null,
      response: '🔁 Gunakan /enableloop daily_ai_os_briefing untuk mengaktifkan daily loop, atau /loopstatus untuk melihat status semua loop.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent === 'disable_daily_loop') {
    return {
      handled: true,
      intent: 'disable_daily_loop',
      command: null,
      response: '⏸ Gunakan /disableloop daily_ai_os_briefing untuk menonaktifkan daily loop, atau /loopstatus untuk melihat status semua loop.',
      risk,
      rawText: text,
      chatId
    };
  }

  if (matchedCommand) {
    return {
      handled: true,
      intent: intentResult.intent,
      command: matchedCommand,
      commandName: intentResult.command,
      risk,
      classification: intentResult,
      rawText: text,
      chatId
    };
  }

  if (intentResult.intent !== 'unknown') {
    return {
      handled: true,
      intent: intentResult.intent,
      command: null,
      commandName: intentResult.command,
      risk,
      classification: intentResult,
      rawText: text,
      chatId
    };
  }

  return {
    handled: false,
    intent: 'unknown',
    command: null,
    response: 'Maaf, saya tidak mengerti. Gunakan /menu untuk melihat perintah yang tersedia.',
    rawText: text,
    chatId
  };
}

function classifyTelegramIntent(message, context) {
  return intentClassifier.classifyTelegramIntent(message, context);
}

function mapIntentToCommand(intent) {
  if (!intent) return null;
  const cmdName = intent.command || intent.intent;
  if (!cmdName) return null;
  return registry.getTelegramCommand(cmdName);
}

function buildNaturalActionPlan(intentResult) {
  if (!intentResult) return null;

  const plan = {
    intent: intentResult.intent,
    command: intentResult.commandName || (intentResult.command ? intentResult.command.name : null),
    action: intentResult.intent,
    riskLevel: intentResult.risk ? intentResult.risk.level : 'read_only',
    args: {
      raw: intentResult.rawText || '',
      matched: intentResult.classification ? intentResult.classification.matched : ''
    },
    chatId: intentResult.chatId || null,
    userId: intentResult.userId || null
  };

  return plan;
}

function handleShortFollowup(message, context) {
  const text = utils.getMessageText(message) || '';
  if (!context || !context.latestTopic) {
    return { handled: false, topic: null, response: 'Tidak ada konteks sebelumnya.' };
  }

  return {
    handled: true,
    topic: context.latestTopic,
    response: null,
    rawText: text,
    context
  };
}

module.exports = {
  routeTelegramNaturalMessage,
  classifyTelegramIntent,
  mapIntentToCommand,
  buildNaturalActionPlan,
  handleShortFollowup
};
