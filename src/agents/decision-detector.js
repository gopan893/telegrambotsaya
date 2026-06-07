'use strict';

const SIMPLE_GREETING = /^(halo|hai|hi|hello|pagi|siang|malam|makasih|terima kasih|ok|oke)$/i;
const DECISION_PATTERN = /\b(lebih\s+baik|pilih\s+yang\s+mana|pilih\s+mana|harus\s+pilih|sebaiknya|apakah\s+sebaiknya|mana\s+yang|paling\s+bagus|langkah\s+terbaik|tolong\s+nilai|nilai\s+keputusan|aman\s+tidak|lanjut\s+phase|phase\s+berapa|lanjut\s+atau|atau\s+langsung|vs|versus|kenapa\s+(?:kita\s+)?(?:tidak\s+)?(?:pakai|memakai|pilih)|kenapa\s+keputusan)\b/i;
const COMPARISON_PATTERN = /\b(.+)\s+(?:atau|vs|versus)\s+(.+)\b/i;
const RISK_DECISION_PATTERN = /\b(restore|import|overwrite|hapus|delete|drop|token|secret|permission|admin|backup|migrasi|external|shell|webhook)\b/i;
const ACTION_DECISION_PATTERN = /\b(jalankan|eksekusi|run|approve|restore|import|deploy|ubah|update|kirim|hapus)\b/i;
const UNCERTAINTY_PATTERN = /\b(bingung|ragu|tidak\s+yakin|ga\s+yakin|mana|harus|sebaiknya|mending|apakah)\b/i;

function detectComparisonIntent(message = '') {
  return COMPARISON_PATTERN.test(String(message || ''));
}

function detectRiskDecisionIntent(message = '') {
  const text = String(message || '');
  return RISK_DECISION_PATTERN.test(text) && (DECISION_PATTERN.test(text) || UNCERTAINTY_PATTERN.test(text) || ACTION_DECISION_PATTERN.test(text));
}

function detectActionDecisionIntent(message = '') {
  const text = String(message || '');
  return ACTION_DECISION_PATTERN.test(text) && (DECISION_PATTERN.test(text) || UNCERTAINTY_PATTERN.test(text));
}

function detectUncertaintySignal(message = '') {
  return UNCERTAINTY_PATTERN.test(String(message || ''));
}

function detectDecisionIntent(message = '', topics = [], context = {}) {
  const text = String(message || '').trim();
  if (!text || SIMPLE_GREETING.test(text)) return { decision: false, reason: 'simple_message' };
  if (/^\//.test(text) && !/^\/(decision|compare|proscons|risk|confidence)\b/i.test(text)) return { decision: false, reason: 'non_decision_command' };
  const comparison = detectComparisonIntent(text);
  const risk = detectRiskDecisionIntent(text);
  const action = detectActionDecisionIntent(text);
  const uncertainty = detectUncertaintySignal(text);
  const roadmap = /\b(phase|roadmap|lanjut|prioritas|langkah terbaik)\b/i.test(text);
  const explicit = DECISION_PATTERN.test(text);
  const knowledgeRemember = /ingat\s+ini\s+sebagai\s+keputusan\s+project/i.test(text);
  const knowledgeAsk = /(?:kenapa|apa)\s+(?:kita\s+)?(?:tidak\s+)?(?:pakai|memakai|keputusan)/i.test(text);
  const knowledgeCleanup = /hapus\s+memory\s+yang\s+duplikat|cleanup\s+memory|deduplicat/i.test(text);
  const knowledgeRead = /apa\s+yang\s+harus\s+opencode\s+baca|opencode\s+baca|apa\s+yang\s+harus\s+(?:aku|saya)\s+baca/i.test(text);
  const decisionTopic = topics.some(topic => ['decision', 'roadmap', 'planning', 'security', 'restore', 'executor'].includes(topic));
  const suppressedByKnowledge = knowledgeCleanup || knowledgeRead;
  return {
    decision: !suppressedByKnowledge && Boolean(explicit || comparison || risk || action || knowledgeRemember || knowledgeAsk || (uncertainty && (roadmap || decisionTopic))),
    comparison,
    risk,
    action,
    uncertainty,
    roadmap,
    reason: suppressedByKnowledge ? 'knowledge_lookup_not_decision' : (knowledgeRemember ? 'knowledge_remember' : (knowledgeAsk ? 'knowledge_ask_decision' : (explicit ? 'explicit_decision_language' : (risk ? 'risk_decision' : (comparison ? 'comparison' : (uncertainty ? 'uncertainty_signal' : 'none'))))))
  };
}

function isDecisionRequest(message = '', context = {}, services = {}) {
  return detectDecisionIntent(message, context.topics || [], context).decision;
}

function shouldTriggerDecisionSystem(message = '', routerPolicy = {}, councilResult = {}, delegationResult = {}, services = {}) {
  const detection = detectDecisionIntent(message, routerPolicy.topics || [], {
    routerPolicy,
    councilResult,
    delegationResult
  });
  if (!detection.decision) return { needed: false, reason: detection.reason || 'not_decision', detection };
  if (/^(halo|hai|hi|hello)$/i.test(String(message || '').trim())) return { needed: false, reason: 'greeting', detection };
  return {
    needed: true,
    mode: detection.risk ? 'risk_decision' : (detection.comparison ? 'comparison' : 'decision'),
    reason: detection.reason,
    detection
  };
}

module.exports = {
  detectActionDecisionIntent,
  detectComparisonIntent,
  detectDecisionIntent,
  detectRiskDecisionIntent,
  detectUncertaintySignal,
  isDecisionRequest,
  shouldTriggerDecisionSystem
};
