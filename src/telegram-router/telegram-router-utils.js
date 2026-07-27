'use strict';

const intentClassifier = require('./telegram-intent-classifier');
const riskDetector = require('./telegram-risk-detector');
const agentSelector = require('./telegram-agent-selector');

function buildFullRoutingReport(text, ctx) {
  const msg = String(text || '');
  const intent = intentClassifier.classifyTelegramIntent(msg);
  const risk = riskDetector.detectTelegramActionRisk(msg, intent, {});
  const agent = agentSelector.selectAgentForTelegramIntent(intent, {});
  const domain = intent.domain;
  return {
    text: msg.slice(0, 200),
    domain,
    intent: intent.intent,
    confidence: intent.confidence,
    riskLevel: intent.riskLevel,
    isDangerous: risk.isDangerous,
    requiresApproval: intent.requiresApproval || risk.isDangerous,
    suggestedAgent: agent.primary,
    agentTeam: agent.agents,
    explanation: agent.explanation,
    risks: risk.risks
  };
}

function isDangerousDomain(domain) {
  return ['deploy', 'ops'].includes(domain);
}

function isOwnerOnlyDomain(domain) {
  return ['approval', 'privacy', 'deploy', 'settings'].includes(domain);
}

function normalizeInputForRouter(text) {
  if (!text) return '';
  return String(text).trim();
}

module.exports = {
  buildFullRoutingReport,
  isDangerousDomain,
  isOwnerOnlyDomain,
  normalizeInputForRouter
};
