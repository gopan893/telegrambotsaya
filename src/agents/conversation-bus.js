'use strict';

const agentRegistry = require('./agent-registry');
const agentRouter = require('./agent-router');
const promptComposer = require('./agent-prompt-composer');
const responseRenderer = require('./agent-response-renderer');
const policy = require('./response-policy');
const topicClassifier = require('./topic-classifier');
const telegramClient = require('../multibot/telegram-client');
const fileIntentGuard = require('../multimodal/file-intent-guard');
const outputSanitizer = require('../ai-os/output-sanitizer');
const {
  AGENT_ACTIVITY_KEY,
  AGENT_FINGERPRINT_KEY,
  GROUP_SETTINGS_KEY,
  buildMessageFingerprint,
  buildSafeText,
  createId,
  isLikelyBotMessage,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeSummary
} = require('./agent-utils');

const AGENT_RECENT_TOPIC_KEY = 'agent_recent_chat_topics';

function sanitizeDomainLeakage(text = '', event = {}, route = {}) {
  const topics = route.topics || topicClassifier.classifyMessageTopic(event.text || '', route || {});
  const personalDomain = topicClassifier.isPersonalDomainMessage(event.text || '', topics);
  if (!personalDomain) return text;
  return String(text || '')
    .split('\n')
    .filter(line => {
      const raw = line.toLowerCase();
      if (raw.includes('fokus saya: cek akar masalah teknis')) return false;
      if (raw.includes('risiko regresi')) return false;
      if (raw.includes('langkah implementasi paling kecil')) return false;
      if (raw.includes('error python')) return false;
      if (raw.includes('stack trace')) return false;
      if (raw.includes('debug') || raw.includes('deploy')) return false;
      return true;
    })
    .join('\n')
    .replace(/\b(coder|ops)\s+agent\b[:. ]*/gi, '')
    .trim();
}

function isLikelyGroupChat(chatId = '', event = {}) {
  if (event.chatType && event.chatType !== 'private') return true;
  return String(chatId || '').startsWith('-');
}

function isMultiBotAvailable(services = {}) {
  try {
    return Boolean(services.botRegistry?.isMultiBotEnabled?.(services.env || process.env));
  } catch (_) {
    return false;
  }
}

function buildDefaultGroupSettings(chatId, services = {}, event = {}) {
  const multiBotGroup = isLikelyGroupChat(chatId, event) && isMultiBotAvailable(services);
  return {
    chatId: String(chatId),
    mode: 'natural_smart',
    maxAutoAgents: 3,
    allowAllAgents: false,
    orchestratorBotId: 'default',
    multiBotVisibleReplies: multiBotGroup,
    visibleSpecialistReplies: multiBotGroup ? 'selected' : 'off',
    maxVisibleSpecialistBots: 2,
    updatedBy: '',
    updatedAt: null
  };
}

function normalizeVisibleReplyMode(value, fallback = 'off') {
  return ['off', 'selected', 'council_only'].includes(String(value || '')) ? String(value) : fallback;
}

function sanitizeAgentTelegramText(text = '', event = {}, services = {}, route = {}) {
  const fileRelated = fileIntentGuard.isFileRelatedMessage(event.text || '', {
    event,
    hasAttachment: Boolean(event.update?.message?.photo || event.update?.message?.document || event.update?.message?.voice)
  });
  const domainClean = sanitizeDomainLeakage(responseRenderer.stripDebugFromNaturalReply(text), event, route);
  return outputSanitizer.sanitizeAssistantVisibleText(domainClean, {
    userText: event.text || '',
    fileRelated,
    forceClean: true
  });
}

async function sendAsConfiguredBot(botId, chatId, text, options = {}, services = {}) {
  const client = services.telegramClient?.sendMessageAsBot ? services.telegramClient : telegramClient;
  return client.sendMessageAsBot(botId, chatId, text, options, services);
}

function createConversationEvent(update = {}, context = {}, services = {}) {
  const msg = update.message || update.edited_message || {};
  const chat = msg.chat || {};
  const from = msg.from || {};
  return {
    id: createId('agent_evt'),
    updateId: update.update_id || null,
    chatId: String(chat.id || context.chatId || ''),
    chatType: chat.type || context.chatType || 'private',
    messageId: msg.message_id || context.messageId || null,
    userId: String(from.id || context.userId || ''),
    text: String(msg.text || msg.caption || context.text || ''),
    botId: update.__botId || msg.__botId || context.botId || 'default',
    agentId: update.__agentId || msg.__agentId || context.agentId || 'orchestrator',
    botUsername: update.__botUsername || msg.__botUsername || context.botUsername || '',
    source: update.__source || msg.__source || context.source || 'legacy',
    isBotMessage: isLikelyBotMessage(update),
    createdAt: nowIso(),
    update
  };
}

async function getGroupSettings(chatId, services = {}) {
  const all = await safeRead(GROUP_SETTINGS_KEY, {}, services);
  const defaults = buildDefaultGroupSettings(chatId, services);
  return { ...defaults, ...(all[String(chatId)] || {}) };
}

async function getRecentChatTopic(chatId, userId, services = {}) {
  const all = await safeRead(AGENT_RECENT_TOPIC_KEY, {}, services);
  const scopedKey = `${String(chatId)}:${String(userId || '')}`;
  const chatKey = String(chatId);
  const item = all[scopedKey] || all[chatKey] || null;
  if (!item) return null;
  const ageMs = Date.now() - Number(item.ts || 0);
  if (ageMs > Number(services.agentRecentTopicTtlMs || 20 * 60 * 1000)) return null;
  return item;
}

async function rememberChatTopic(chatId, userId, topics = [], text = '', services = {}) {
  const cleanTopics = (topics || []).filter(topic => topic && topic !== 'unknown' && topic !== 'casual');
  if (!cleanTopics.length) return null;
  const all = await safeRead(AGENT_RECENT_TOPIC_KEY, {}, services);
  const item = sanitizeSummary({
    chatId: String(chatId),
    userId: String(userId || ''),
    topics: cleanTopics.slice(0, 8),
    textPreview: buildSafeText(text, 180),
    ts: Date.now(),
    updatedAt: nowIso()
  });
  all[`${String(chatId)}:${String(userId || '')}`] = item;
  all[String(chatId)] = item;
  const keys = Object.keys(all);
  if (keys.length > 500) {
    keys.sort((a, b) => Number(all[b].ts || 0) - Number(all[a].ts || 0))
      .slice(500)
      .forEach(key => delete all[key]);
  }
  await safeWrite(AGENT_RECENT_TOPIC_KEY, all, services);
  return item;
}

async function setGroupSettings(chatId, patch = {}, services = {}) {
  const all = await safeRead(GROUP_SETTINGS_KEY, {}, services);
  const previous = all[String(chatId)] || {};
  const next = {
    chatId: String(chatId),
    mode: patch.mode || previous.mode || 'natural_smart',
    maxAutoAgents: Number(patch.maxAutoAgents || previous.maxAutoAgents || 3),
    allowAllAgents: Boolean(patch.allowAllAgents ?? previous.allowAllAgents),
    orchestratorBotId: patch.orchestratorBotId || previous.orchestratorBotId || 'default',
    multiBotVisibleReplies: Boolean(patch.multiBotVisibleReplies ?? previous.multiBotVisibleReplies ?? false),
    visibleSpecialistReplies: normalizeVisibleReplyMode(patch.visibleSpecialistReplies, previous.visibleSpecialistReplies || 'off'),
    maxVisibleSpecialistBots: Math.min(Math.max(Number(patch.maxVisibleSpecialistBots || previous.maxVisibleSpecialistBots || 2), 0), 5),
    updatedBy: String(patch.updatedBy || previous.updatedBy || ''),
    updatedAt: nowIso()
  };
  all[String(chatId)] = next;
  await safeWrite(GROUP_SETTINGS_KEY, all, services);
  return next;
}

async function preventDuplicateReplies(event = {}, services = {}) {
  const fingerprint = buildMessageFingerprint(event);
  const data = await safeRead(AGENT_FINGERPRINT_KEY, {}, services);
  const now = Date.now();
  const ttlMs = Number(services.agentDuplicateTtlMs || 120000);
  for (const [key, item] of Object.entries(data)) {
    if (now - Number(item.ts || 0) > ttlMs) delete data[key];
  }
  if (data[fingerprint]) {
    await safeWrite(AGENT_FINGERPRINT_KEY, data, services);
    return false;
  }
  data[fingerprint] = { ts: now };
  await safeWrite(AGENT_FINGERPRINT_KEY, data, services);
  return true;
}

async function routeConversationEvent(event = {}, services = {}) {
  const groupSettings = await getGroupSettings(event.chatId, services);
  if (event.isBotMessage) {
    return {
      ok: false,
      reason: 'BOT_MESSAGE_IGNORED',
      event,
      route: null
    };
  }
  const recent = await getRecentChatTopic(event.chatId, event.userId, services);
  const route = agentRouter.routeMessage(event.text, {
    chatId: event.chatId,
    userId: event.userId,
    groupSettings,
    previousTopics: event.previousTopics || recent?.topics || [],
    previousText: event.previousText || recent?.textPreview || '',
    forceMode: event.forceMode || groupSettings.mode || 'natural_smart'
  }, services);
  return { ok: true, event, groupSettings, route };
}

async function buildAgentDraft(agent, event, route, services = {}) {
  const text = buildSafeText(event.text, 220);
  const risk = route.risk?.level || 'low';
  const prefix = `Saya bertindak sebagai ${agent.displayName}.`;
  let composed = null;
  let memoryHint = '';
  try {
    composed = await promptComposer.composeAgentFinalPrompt(agent.id, event.text, {
      chatId: event.chatId,
      userId: event.userId,
      workspaceId: services.workspaceId || 'default',
      topics: route.topics || [],
      risk,
      mode: route.policy?.mode || route.mode || 'natural_smart'
    }, services);
    const used = (composed.selectedMemories || []).length + (composed.sharedMemories || []).length;
    if (used > 0) {
      const titles = [...(composed.selectedMemories || []), ...(composed.sharedMemories || [])]
        .slice(0, 3)
        .map(memory => memory.title)
        .join(', ');
      memoryHint = ` Konteks memory relevan: ${buildSafeText(titles, 180)}.`;
    }
  } catch (err) {
    memoryHint = ' Memory agent tidak tersedia, saya pakai routing dasar.';
  }
  const templates = {
    orchestrator: `${prefix} Saya pilih mode ${route.policy?.mode || 'natural_smart'} untuk topik ${route.topics.join(', ')}.${memoryHint} ${route.approvalRequired ? 'Aksi penting perlu approval eksplisit.' : 'Saya akan jaga jawaban tetap ringkas.'}`,
    planner: `${prefix} Fokus saya: ubah ini menjadi 2-3 langkah prioritas yang bisa dikerjakan berikutnya.${memoryHint}`,
    coder: `${prefix} Fokus saya: cek akar masalah teknis, risiko regresi, dan langkah implementasi paling kecil.${memoryHint}`,
    critic: `${prefix} Risiko utama: scope melebar, asumsi belum tervalidasi, atau perubahan menyentuh fitur lama.${memoryHint}`,
    research: `${prefix} Saya bisa bantu cari opsi/API, tapi untuk data terbaru perlu tool search yang aman.${memoryHint}`,
    ops: `${prefix} Saya cek dari sisi deploy, health, PostgreSQL/Redis, webhook, dan fallback Render.${memoryHint}`,
    security: `${prefix} Saya melihat level risiko ${risk}. Jangan kirim token/secret di chat; gunakan env aman dan approval untuk restore/import.${memoryHint}`,
    memory: `${prefix} Saya akan memakai konteks yang relevan saja dari memory/graph, bukan semua data.${memoryHint}`,
    executor: `${prefix} Saya hanya boleh membuat proposal eksekusi. Tidak ada write/external/danger action tanpa /approve dan /runexec.${memoryHint}`,
    reflection: `${prefix} Saya akan bantu menenangkan konteks, memilah beban, lalu pilih satu langkah kecil.${memoryHint}`
  };
  return {
    agentId: agent.id,
    botId: agent.botId,
    visible: (route.selectedAgents || []).includes(agent.id),
    text: templates[agent.id] || `${prefix} Saya relevan untuk pesan: ${text}${memoryHint}`,
    selectedMemoryCount: composed ? ((composed.selectedMemories || []).length + (composed.sharedMemories || []).length) : 0,
    memoryExplanation: composed?.memoryExplanation || '',
    promptPreview: composed?.promptPreview || ''
  };
}

async function collectAgentDrafts(event = {}, routeOrPolicy = {}, services = {}) {
  const route = routeOrPolicy.route || routeOrPolicy;
  const selectedIds = [...(route.selectedAgents || []), ...(route.internalOnlyAgents || [])];
  const agents = selectedIds.map(agentId => agentRegistry.getAgent(agentId, services)).filter(Boolean);
  return await Promise.all(agents.map(agent => buildAgentDraft(agent, event, route, services)));
}

async function sendAgentResponses(event = {}, route = {}, responses = [], services = {}) {
  const mode = route.policy?.mode || route.mode || route.commandMode || 'natural_smart';
  if (!['council', 'debate', 'allagents'].includes(mode) && !services.debugAgentRouting) {
    const text = responseRenderer.renderNaturalSmartReply(event, route, responses, {
      event,
      route,
      text: event.text,
      topics: route.topics || []
    }, services);
    const groupSettings = await getGroupSettings(event.chatId, services);
    await sendAsConfiguredBot(groupSettings.orchestratorBotId || event.botId || 'default', event.chatId, sanitizeAgentTelegramText(text, event, services, route), {
      reply_to_message_id: event.messageId || undefined,
      disable_web_page_preview: true,
      userText: event.text || '',
      fileRelated: fileIntentGuard.isFileRelatedMessage(event.text || '', { event })
    }, services);
    const specialistResult = await sendVisibleSpecialistReplies(event, route, responses, services, { groupSettings, mode });
    return { sent: 1 + specialistResult.sent, specialistSent: specialistResult.sent, specialistBotIds: specialistResult.botIds };
  }
  const order = policy.buildResponseOrder(route.policy || route);
  const visible = responses.filter(item => (route.selectedAgents || []).includes(item.agentId));
  const sorted = visible.sort((a, b) => order.indexOf(a.agentId) - order.indexOf(b.agentId));
  for (const response of sorted) {
    await sendAsConfiguredBot(response.botId, event.chatId, sanitizeAgentTelegramText(response.text, event, services, route), {
      reply_to_message_id: event.messageId || undefined,
      disable_web_page_preview: true,
      userText: event.text || '',
      fileRelated: fileIntentGuard.isFileRelatedMessage(event.text || '', { event })
    }, services);
  }
  return { sent: sorted.length };
}

async function sendVisibleSpecialistReplies(event = {}, route = {}, responses = [], services = {}, options = {}) {
  const groupSettings = options.groupSettings || await getGroupSettings(event.chatId, services);
  const mode = options.mode || route.policy?.mode || route.mode || route.commandMode || 'natural_smart';
  if (groupSettings.mode === 'quiet' || route.policy?.mode === 'quiet') return { sent: 0, botIds: [] };
  if (!groupSettings.multiBotVisibleReplies) return { sent: 0, botIds: [] };
  if (groupSettings.visibleSpecialistReplies === 'off') return { sent: 0, botIds: [] };
  if (groupSettings.visibleSpecialistReplies === 'council_only' && !['council', 'debate', 'risk_review', 'decision_review'].includes(mode)) {
    return { sent: 0, botIds: [] };
  }

  const selected = new Set(route.selectedAgents || []);
  const internal = new Set(route.internalOnlyAgents || []);
  const muted = new Set(route.mutedAgents || []);
  const max = Math.min(Math.max(Number(groupSettings.maxVisibleSpecialistBots || 2), 0), 5);
  if (max <= 0) return { sent: 0, botIds: [] };
  const specialists = responses
    .filter(item => item.agentId && item.agentId !== 'orchestrator')
    .filter(item => selected.has(item.agentId))
    .filter(item => !internal.has(item.agentId) && !muted.has(item.agentId))
    .slice(0, max);

  const sentBotIds = [];
  for (const response of specialists) {
    const clean = sanitizeAgentTelegramText(response.text, event, services, route);
    if (!clean) continue;
    await sendAsConfiguredBot(response.botId || response.agentId, event.chatId, clean, {
      reply_to_message_id: event.messageId || undefined,
      disable_web_page_preview: true,
      userText: event.text || '',
      fileRelated: fileIntentGuard.isFileRelatedMessage(event.text || '', { event })
    }, services);
    sentBotIds.push(response.botId || response.agentId);
  }
  return { sent: sentBotIds.length, botIds: sentBotIds };
}

async function recordAgentActivity(event = {}, route = {}, responses = [], services = {}) {
  const activity = await safeRead(AGENT_ACTIVITY_KEY, [], services);
  const item = sanitizeSummary({
    id: createId('agent_act'),
    chatId: event.chatId,
    userId: event.userId,
    botId: event.botId,
    topics: route.topics || [],
    riskLevel: route.risk?.level || route.riskLevel || 'low',
    mode: route.policy?.mode || route.mode || 'natural_smart',
    selectedAgents: route.selectedAgents || [],
    internalOnlyAgents: route.internalOnlyAgents || [],
    mutedAgents: route.mutedAgents || [],
    reason: route.reason || route.policy?.reason || '',
    messagePreview: buildSafeText(event.text, 180),
    responseCount: responses.length,
    memoryUse: responses.map(response => ({
      agentId: response.agentId,
      selectedMemoryCount: Number(response.selectedMemoryCount || 0)
    })),
    createdAt: nowIso()
  });
  activity.unshift(item);
  await safeWrite(AGENT_ACTIVITY_KEY, activity.slice(0, 200), services);
  try {
    await rememberChatTopic(event.chatId, event.userId, route.topics || [], event.text || '', services);
    await services.auditLog?.recordAuditLog?.({
      actorType: 'telegram',
      actorId: event.userId,
      action: 'agents/routing_decision',
      targetType: 'chat',
      targetId: event.chatId,
      userId: event.userId,
      workspaceId: services.workspaceId || '',
      decision: 'allowed',
      status: 'ok',
      afterSummary: item
    }, services);
  } catch (_) {}
  return item;
}

async function listAgentActivity(options = {}, services = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 30), 1), 100);
  const items = await safeRead(AGENT_ACTIVITY_KEY, [], services);
  return items.slice(0, limit);
}

module.exports = {
  createConversationEvent,
  collectAgentDrafts,
  getRecentChatTopic,
  getGroupSettings,
  listAgentActivity,
  rememberChatTopic,
  preventDuplicateReplies,
  recordAgentActivity,
  routeConversationEvent,
  sendAgentResponses,
  sendVisibleSpecialistReplies,
  setGroupSettings
};
