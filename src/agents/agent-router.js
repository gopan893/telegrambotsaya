'use strict';

const classifier = require('./topic-classifier');
const riskDetector = require('./risk-detector');
const scoring = require('./agent-scoring');
const responsePolicy = require('./response-policy');
const { maskSecret, sanitizeSummary } = require('./agent-utils');

function routeMessage(message, context = {}, services = {}) {
  const text = typeof message === 'string' ? message : String(message?.text || '');
  const topics = classifier.classifyMessageTopic(text, context, services);
  const mentionedAgents = classifier.detectMentionedAgents(text, services);
  const commandMode = context.forceMode || classifier.detectCommandMode(text);
  const language = classifier.detectLanguage(text);
  const intentSignals = classifier.extractIntentSignals(text);
  const risk = riskDetector.detectMessageRisk(text, topics, context, services);
  const scoreContext = { ...context, topics, mentionedAgents, commandMode };
  const scores = scoring.scoreAgentsForMessage(text, topics, risk, scoreContext, services);
  const policy = responsePolicy.decideResponsePolicy(text, {
    ...scoreContext,
    intentSignals,
    language
  }, scores, risk, services);
  return sanitizeRoutingResult({
    text: maskSecret(text),
    topics,
    mentionedAgents,
    commandMode,
    language,
    intentSignals,
    risk,
    scores: scoring.explainAgentSelection(scores),
    policy,
    selectedAgents: policy.selectedAgents,
    internalOnlyAgents: policy.internalOnlyAgents,
    mutedAgents: policy.mutedAgents,
    approvalRequired: policy.approvalRequired,
    reason: policy.reason
  });
}

function sanitizeRoutingResult(result = {}) {
  return sanitizeSummary({
    ...result,
    risk: result.risk ? {
      level: result.risk.level,
      riskLevel: result.risk.riskLevel,
      secretDetected: Boolean(result.risk.secretDetected),
      actionRequested: Boolean(result.risk.actionRequested),
      writeOrExternalIntent: Boolean(result.risk.writeOrExternalIntent),
      dangerIntent: Boolean(result.risk.dangerIntent),
      sanitizedText: maskSecret(result.risk.sanitizedText || ''),
      reasons: result.risk.reasons || []
    } : null
  });
}

function detectNaturalAgentNeed(text, context = {}, services = {}) {
  const route = routeMessage(text, context, services);
  const selected = route.selectedAgents || [];
  return {
    needed: selected.length > 1 || route.approvalRequired || route.risk?.level === 'high' || route.risk?.level === 'danger',
    route
  };
}

module.exports = {
  detectNaturalAgentNeed,
  routeMessage,
  sanitizeRoutingResult
};
