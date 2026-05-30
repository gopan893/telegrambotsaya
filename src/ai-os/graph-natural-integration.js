'use strict';

const graph = require('./knowledge-graph');
const retriever = require('./graph-retriever');
const summarizer = require('./graph-summarizer');
const graphUtils = require('./graph-utils');
const naturalAIOS = require('./natural-integration');

const GRAPH_TRIGGERS = [
  /hubungan|relasi|terkait|kaitan/i,
  /knowledge\s+graph|graph|graf/i,
  /konsep\s+(penting|sering|utama|berkembang)/i,
  /dependency|dependencies|ketergantungan|bergantung/i,
  /risiko.*(terhubung|terkait|roadmap|goal|workflow|project)/i,
  /bertentangan|kontradiksi|contradict/i,
  /tunjukkan.*graph|ringkasan.*graph/i
];

function normalizeText(text = '') {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function isSimpleMath(text = '') {
  return naturalAIOS.isSimpleMath ? naturalAIOS.isSimpleMath(text) : /^[\d\s+\-*/().,%]+$/.test(normalizeText(text));
}

function isSimpleGreeting(text = '') {
  return naturalAIOS.isSimpleGreeting ? naturalAIOS.isSimpleGreeting(text) : /^(halo|hai|hi|hello|ok|oke|makasih|terima kasih)$/i.test(normalizeText(text));
}

function detectGraphNaturalNeed(text = '', adaptiveResult = {}) {
  const clean = normalizeText(text);
  if (!clean || clean.startsWith('/')) return { needed: false, reason: 'empty_or_command', confidence: 0 };
  if (isSimpleGreeting(clean)) return { needed: false, reason: 'simple_greeting', confidence: 0.05 };
  if (isSimpleMath(clean)) return { needed: false, reason: 'simple_math', confidence: 0.05 };

  const matched = GRAPH_TRIGGERS.find(pattern => pattern.test(clean));
  if (matched) return { needed: true, reason: 'graph_keyword', confidence: 0.86 };

  const mode = String(adaptiveResult?.mode || '').toLowerCase();
  if (['cognitive-workspace', 'strategic', 'decision'].includes(mode) && /(konsep|roadmap|risk|risiko|dependency|relasi)/i.test(clean)) {
    return { needed: true, reason: `adaptive_${mode}`, confidence: 0.62 };
  }

  return { needed: false, reason: 'no_graph_trigger', confidence: 0.12 };
}

function inferGraphAnswerType(text = '') {
  const lower = normalizeText(text).toLowerCase();
  if (/bertentangan|kontradiksi|contradict/.test(lower)) return 'contradictions';
  if (/dependency|dependencies|ketergantungan|bergantung/.test(lower)) return 'dependencies';
  if (/risiko|resiko/.test(lower)) return 'risks';
  if (/konsep.*(penting|sering|utama|berkembang)/.test(lower)) return 'concepts';
  if (/hubungan|relasi|terkait|kaitan/.test(lower)) return 'relationship';
  return 'summary';
}

function buildEmptyGraphAnswer() {
  return [
    'Knowledge graph belum punya cukup data untuk menjawab itu.',
    '',
    'Cara mengisinya:',
    '- /remember Saya memakai PostgreSQL untuk persistent memory dan Redis untuk cache bot AI',
    '- /goaladd Bangun AI OS production | Membuat bot dengan memory, workflow, graph, dan ops | high',
    '- /relate PostgreSQL | persistent memory | supports | PostgreSQL menyimpan memory jangka panjang',
    '',
    'Setelah ada data, kamu bisa tanya lagi tentang hubungan, dependency, risiko, atau konsep penting.'
  ].join('\n');
}

function buildGraphAnswer(userId, text = '', services = {}) {
  const type = inferGraphAnswerType(text);
  const stats = graph.getGraphStats(userId, services);
  if (!stats.nodes && !stats.edges) return buildEmptyGraphAnswer();

  if (type === 'dependencies') {
    return summarizer.summarizeDependencies(userId, {}, services).summaryText;
  }
  if (type === 'risks') {
    return summarizer.summarizeRisks(userId, {}, services).summaryText;
  }
  if (type === 'contradictions') {
    return summarizer.summarizeContradictions(userId, {}, services).summaryText;
  }
  if (type === 'concepts') {
    const nodes = graph.listNodes(userId, { query: text, limit: 10 }, services);
    return [
      'Konsep penting yang terlihat:',
      '',
      ...(nodes.length ? nodes.map((node, index) => `${index + 1}. ${node.label} (${node.type}, muncul ${node.occurrenceCount || 1}x)`) : ['Belum cukup data konsep.']),
      '',
      'Catatan: ini ranking heuristic dari importance, confidence, recency, dan frekuensi kemunculan.'
    ].join('\n');
  }
  if (type === 'relationship') {
    const relevant = retriever.getRelevantGraph(userId, text, { nodeLimit: 8, edgeLimit: 12 }, services);
    if (!relevant.nodes?.length && !relevant.edges?.length) return buildEmptyGraphAnswer();
    const labelById = new Map(relevant.nodes.map(node => [node.id, node.label]));
    return [
      'Hubungan yang terlihat dari graph:',
      '',
      relevant.edges.length
        ? relevant.edges.map((edge, index) => `${index + 1}. ${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to}\n   Evidence: ${graphUtils.compactText(edge.evidence, 180)}\n   Confidence: ${Number(edge.confidence || 0).toFixed(2)}`).join('\n')
        : 'Belum ada relasi eksplisit untuk query ini.',
      '',
      relevant.nodes.length ? `Konsep terkait: ${relevant.nodes.map(node => node.label).join(', ')}` : '',
      '',
      'Kalau relasi penting belum muncul, tambahkan manual dengan /relate.'
    ].filter(Boolean).join('\n');
  }

  return summarizer.summarizeGraph(userId, { query: text }, services).summaryText;
}

async function answerWithGraphContext(userId, chatId, text = '', msg = {}, services = {}) {
  const adaptiveResult = services.adaptiveDecision || services.adaptiveResult || {};
  const detection = detectGraphNaturalNeed(text, adaptiveResult);
  if (!detection.needed) return { handled: false, reason: detection.reason };

  try {
    await graph.hydrateGraphFromStorage?.(userId, services);
    const answer = buildGraphAnswer(userId, text, services);
    const send = services.sendChunkedMessage || services.safeSendMessage;
    if (typeof send === 'function') {
      await send(chatId, answer, { reply_to_message_id: msg.message_id });
    }
    return {
      handled: true,
      answer,
      type: inferGraphAnswerType(text),
      reason: detection.reason
    };
  } catch (err) {
    services.log?.warn?.('Graph natural integration fallback:', err.message);
    return { handled: false, reason: 'graph_natural_error', error: err.message };
  }
}

module.exports = {
  answerWithGraphContext,
  buildGraphAnswer,
  detectGraphNaturalNeed,
  inferGraphAnswerType
};
