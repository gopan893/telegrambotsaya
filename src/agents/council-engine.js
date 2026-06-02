'use strict';

const moderator = require('./council-moderator');
const opinionCollector = require('./agent-opinion-collector');
const critiqueEngine = require('./cross-agent-critique');
const riskReviewEngine = require('./risk-review-engine');
const decisionSynthesis = require('./decision-synthesis');
const debateEngine = require('./debate-engine');
const councilMemory = require('./council-memory');
const store = require('./council-store');
const {
  auditCouncil,
  containsSecretLike,
  inferRiskLevel,
  isArchitectureText,
  isDangerousActionText,
  isDecisionText,
  isEmotionalText,
  isPlanningText,
  isRecentCouncilDuplicate,
  normalizeWorkspaceId,
  nowIso,
  sanitizeCouncilPayload,
  sanitizeCouncilText,
  unique
} = require('./council-utils');

const EXPLICIT_SOURCES = new Set(['telegram_command', 'dashboard', 'manual']);

function isGreetingOrSimple(text = '') {
  const clean = String(text || '').trim().toLowerCase();
  if (!clean) return true;
  if (/^(halo|hai|hi|hello|pagi|siang|sore|malam|oke|ok|sip|thanks|makasih)\b/.test(clean) && clean.length < 35) return true;
  if (/^\d+\s*([+\-*/x:]|\*)\s*\d+\s*$/.test(clean)) return true;
  if (/^\d+\s*(jam|hari|menit|detik)\b/i.test(clean) && clean.length < 35) return true;
  return false;
}

function hasCouncilTriggerText(text = '') {
  return /\b(menurut kalian|council|debat|debate|risk review|nilai rencana|review rencana|pros|cons|pro kontra|bandingkan|pilih|keputusan|decision|opsi|alternatif|lanjut phase|lanjut tahap|roadmap|prioritas|arsitektur|architecture|dependency|risiko|bertentangan|restore|import|approval)\b/i.test(String(text || ''));
}

function shouldTriggerCouncil(message = '', context = {}, routerPolicy = {}, services = {}) {
  const text = String(message || '');
  const source = context.source || 'natural_chat';
  if (EXPLICIT_SOURCES.has(source)) {
    const riskLevel = inferRiskLevel(context.riskLevel || routerPolicy.risk?.level || routerPolicy.riskLevel || 'low');
    const mode = context.mode || moderator.chooseCouncilMode(text, routerPolicy.topics || [], { level: riskLevel }, context);
    return { needed: true, mode, reason: 'explicit_council_request', riskLevel };
  }
  if (!text.trim() || text.trim().startsWith('/')) return { needed: false, reason: 'command_or_empty' };
  if (isGreetingOrSimple(text)) return { needed: false, reason: 'simple_message' };
  if (isEmotionalText(text) && !/\b(keputusan|rencana|prioritas|langkah)\b/i.test(text)) return { needed: false, reason: 'emotional_support_only' };

  const topics = routerPolicy.topics || context.topics || [];
  const risk = routerPolicy.risk || {};
  const riskLevel = inferRiskLevel(risk.level || context.riskLevel || 'low');
  const approvalRequired = Boolean(routerPolicy.approvalRequired || risk.writeOrExternalIntent || risk.actionRequested || isDangerousActionText(text));
  const selectedCount = Array.isArray(routerPolicy.selectedAgents) ? routerPolicy.selectedAgents.length : 0;
  const mode = moderator.chooseCouncilMode(text, topics, { ...risk, level: riskLevel }, context);
  const triggers = [
    hasCouncilTriggerText(text),
    isPlanningText(text),
    isDecisionText(text),
    isArchitectureText(text) && /\b(pilih|lebih baik|lanjut|risiko|roadmap|phase|opsi)\b/i.test(text),
    ['medium', 'high', 'danger'].includes(riskLevel),
    approvalRequired,
    selectedCount >= 3
  ];
  if (!triggers.some(Boolean)) return { needed: false, reason: 'no_council_trigger' };
  return {
    needed: true,
    mode,
    reason: approvalRequired ? 'approval_or_risk_context' : 'multi_agent_decision_context',
    riskLevel,
    approvalRequired
  };
}

async function createCouncilSession(input = {}, services = {}) {
  const rawText = String(input.originalMessage || input.topic || '');
  if (containsSecretLike(rawText)) {
    await auditCouncil('agents/council_secret_like_rejected', {
      workspaceId: input.workspaceId,
      userId: input.userId,
      source: input.source,
      decision: 'denied',
      status: 'denied',
      reason: 'secret-like content rejected'
    }, services);
    throw Object.assign(new Error('COUNCIL_SECRET_LIKE_CONTENT_REJECTED'), { code: 'COUNCIL_SECRET_LIKE_CONTENT_REJECTED' });
  }
  const text = sanitizeCouncilText(rawText, 900);

  const topics = input.topics || input.routerPolicy?.topics || [];
  const risk = input.routerPolicy?.risk || { level: input.riskLevel || 'low' };
  const mode = input.mode || moderator.chooseCouncilMode(text, topics, risk, input);
  const selectedAgents = moderator.selectCouncilAgents(text, topics, risk, { ...input, mode }, services);
  const approvalRequired = Boolean(input.approvalRequired || input.routerPolicy?.approvalRequired || risk.writeOrExternalIntent || risk.actionRequested || isDangerousActionText(text));
  const riskLevel = inferRiskLevel(input.riskLevel || risk.level || (approvalRequired ? 'medium' : 'low'));
  const base = moderator.enforceCouncilLimits({
    ...input,
    workspaceId: normalizeWorkspaceId(input.workspaceId || services.workspaceId || 'default'),
    source: input.source || 'natural_chat',
    mode,
    topic: sanitizeCouncilText(input.topic || text, 220),
    originalMessage: text,
    selectedAgents,
    riskLevel,
    approvalRequired
  });
  const visibility = moderator.decideVisibleVsInternalAgents(base, input.routerPolicy || {});
  return store.createSession({ ...base, ...visibility }, services);
}

async function collectCouncilOpinions(session = {}, services = {}) {
  const opinions = [];
  for (const agentId of unique(session.selectedAgents || ['orchestrator'])) {
    opinions.push(await opinionCollector.collectOpinionFromAgent(agentId, session, services));
  }
  return opinions;
}

async function runCritiques(session = {}, opinions = [], services = {}) {
  const criticIds = unique([
    opinions.some(item => item.agentId === 'critic') ? 'critic' : '',
    opinions.some(item => item.agentId === 'security') || session.approvalRequired ? 'security' : '',
    session.mode === 'coding_review' ? 'coder' : ''
  ]).filter(Boolean);
  const critiques = [];
  for (const criticId of criticIds) {
    for (const opinion of opinions) {
      if (opinion.agentId !== criticId) critiques.push(critiqueEngine.critiqueOpinion(criticId, opinion, session, services));
    }
  }
  return critiques;
}

async function completeCouncilSession(sessionId, result = {}, services = {}) {
  const patch = sanitizeCouncilPayload({
    status: 'completed',
    opinions: result.opinions || [],
    critiques: result.critiques || [],
    decision: result.decision || null,
    riskReview: result.riskReview || null,
    finalSummary: sanitizeCouncilText(result.finalSummary || result.finalAnswer || '', 1800),
    actionRecommendations: result.decision?.nextSteps || [],
    approvalRequired: Boolean(result.riskReview?.approvalRequired || result.approvalRequired),
    completedAt: nowIso()
  });
  const session = await store.updateSession(sessionId, patch, services);
  await councilMemory.createCouncilSummaryMemory(session, services);
  await auditCouncil('agents/council_session_completed', {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode,
    selectedAgents: session.selectedAgents,
    riskLevel: session.riskLevel,
    approvalRequired: session.approvalRequired
  }, services);
  return session;
}

async function runCouncilSession(sessionId, services = {}) {
  const existing = await store.getSession(sessionId, services);
  if (!existing) throw new Error('COUNCIL_SESSION_NOT_FOUND');
  const collecting = await store.updateSession(sessionId, { status: 'collecting' }, services);

  if (collecting.mode === 'debate') {
    const debate = await debateEngine.runDebate(collecting, services);
    const completed = await completeCouncilSession(sessionId, debate, services);
    return { session: completed, ...debate };
  }

  const opinions = await collectCouncilOpinions(collecting, services);
  const withOpinions = { ...collecting, opinions };
  const critiques = await runCritiques(withOpinions, opinions, services);
  const riskReview = await riskReviewEngine.runRiskReview({ ...withOpinions, critiques }, services);
  const synthesis = await decisionSynthesis.synthesizeDecision({
    ...withOpinions,
    critiques,
    riskReview,
    approvalRequired: riskReview.approvalRequired
  }, services);
  const completed = await completeCouncilSession(sessionId, {
    opinions,
    critiques,
    riskReview,
    ...synthesis
  }, services);
  return { session: completed, opinions, critiques, riskReview, ...synthesis };
}

async function runCouncil(input = {}, services = {}) {
  if (input.source === 'natural_chat' && !input.skipDuplicateCheck) {
    const duplicate = await isRecentCouncilDuplicate(input.originalMessage || input.topic || '', input, services);
    if (duplicate) return { handled: false, duplicate: true, reason: 'recent_council_duplicate' };
  }
  const session = await createCouncilSession(input, services);
  const result = await runCouncilSession(session.id, services);
  return sanitizeCouncilPayload({ handled: true, sessionId: session.id, ...result });
}

async function cancelCouncilSession(sessionId, actor = {}, services = {}) {
  const session = await store.updateSession(sessionId, {
    status: 'cancelled',
    cancelledBy: String(actor.actorId || actor.userId || services.actorId || ''),
    cancelledAt: nowIso()
  }, services);
  await auditCouncil('agents/council_session_cancelled', {
    sessionId,
    workspaceId: session.workspaceId,
    userId: session.userId,
    actorId: actor.actorId || actor.userId || services.actorId || ''
  }, services);
  return session;
}

async function runNaturalCouncilIfNeeded(message = '', context = {}, routerPolicy = {}, services = {}) {
  const need = shouldTriggerCouncil(message, context, routerPolicy, services);
  if (!need.needed) return { handled: false, reason: need.reason };
  return runCouncil({
    ...context,
    source: 'natural_chat',
    mode: need.mode,
    topic: message,
    originalMessage: message,
    routerPolicy,
    riskLevel: need.riskLevel,
    approvalRequired: need.approvalRequired,
    skipDuplicateCheck: context.skipDuplicateCheck
  }, services);
}

module.exports = {
  cancelCouncilSession,
  collectCouncilOpinions,
  completeCouncilSession,
  createCouncilSession,
  listSessions: store.listSessions,
  listSummaries: store.listSummaries,
  getSession: store.getSession,
  runCouncil,
  runCouncilSession,
  runNaturalCouncilIfNeeded,
  shouldTriggerCouncil
};
