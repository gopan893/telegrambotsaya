'use strict';

const observability = require('../agents/observability');
const { getPolicy } = require('./policy-engine');

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function includesAny(text, patterns) {
  const lower = String(text || '').toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function flattenParams(params = {}) {
  try {
    return JSON.stringify(params).slice(0, 2500);
  } catch (_) {
    return String(params || '');
  }
}

function assessContextIntegrity(context = {}) {
  const signals = [];
  let trust = 0.78;
  const contextText = [
    context.summary,
    context.history,
    context.crossModalContext?.mergedEvidence,
    context.fileContext?.primaryContent
  ].filter(Boolean).join('\n').slice(0, 10000);

  if (includesAny(contextText, [
    'ignore previous',
    'abaikan instruksi',
    'override system',
    'system prompt',
    'jailbreak',
    'hapus semua data',
    'delete all data'
  ])) {
    trust -= 0.45;
    signals.push('CONTEXT_MANIPULATION');
  }

  if (context.crossModalContext?.confidence !== undefined && context.crossModalContext.confidence < 0.45) {
    trust -= 0.16;
    signals.push('LOW_TRUST_ATTACHMENT');
  }

  if (context.fileContext?.integrity && context.fileContext.integrity.ok === false) {
    trust -= 0.2;
    signals.push('FILE_INTEGRITY_WEAK');
  }

  return {
    trustScore: clamp01(trust),
    signals
  };
}

function assessActionRisk(traceId, input = {}) {
  const {
    userMessage = '',
    intent = 'NONE',
    params = {},
    nlpConfidence = 0.5,
    context = {},
    hasAttachment = false
  } = input;

  const policy = getPolicy(intent);
  const paramText = flattenParams(params);
  const combinedText = `${userMessage}\n${paramText}`;
  const contextIntegrity = assessContextIntegrity(context);
  const factors = [];
  const flags = [...contextIntegrity.signals];
  let score = 0.12;

  const policyRiskWeight = {
    low: 0.12,
    medium: 0.28,
    high: 0.52,
    critical: 0.78
  };
  score += policyRiskWeight[policy.riskLevel] ?? 0.2;

  if (Number(nlpConfidence) < 0.7 && policy.intent !== 'NONE') {
    score += 0.18;
    factors.push('NLP_CONFIDENCE_LOW');
  }
  if (Number(nlpConfidence) < 0.5) {
    score += 0.12;
    flags.push('LOW_CONFIDENCE');
  }
  if (hasAttachment) {
    score += 0.06;
    factors.push('ATTACHMENT_CONTEXT_PRESENT');
  }
  if (contextIntegrity.trustScore < 0.55) {
    score += 0.26;
    factors.push('CONTEXT_TRUST_LOW');
  }
  if (includesAny(combinedText, [
    'hapus',
    'delete',
    'reset',
    'ban',
    'kick',
    'force',
    'paksa',
    'bypass',
    'jailbreak',
    'ignore previous',
    'abaikan instruksi'
  ])) {
    score += 0.2;
    factors.push('SENSITIVE_OR_DESTRUCTIVE_LANGUAGE');
  }
  if (includesAny(combinedText, [
    'token',
    'api key',
    'password',
    'secret',
    'credential',
    'private key'
  ])) {
    score += 0.18;
    flags.push('SENSITIVE_DATA_MENTIONED');
  }
  if (flags.includes('CONTEXT_MANIPULATION')) {
    score += 0.25;
    factors.push('SUSPICIOUS_CONTEXT');
  }

  const riskScore = clamp01(score);
  const riskLevel = riskScore >= 0.78
    ? 'critical'
    : riskScore >= 0.58
      ? 'high'
      : riskScore >= 0.34
        ? 'medium'
        : 'low';

  const assessment = {
    intent: policy.intent,
    riskScore,
    riskLevel,
    factors,
    flags: [...new Set(flags)],
    contextTrustScore: contextIntegrity.trustScore,
    confidence: clamp01(nlpConfidence),
    requiresApproval: policy.requiresApproval || riskScore >= 0.7,
    recommendedAction: riskScore >= 0.82 || flags.includes('CONTEXT_MANIPULATION')
      ? 'BLOCK'
      : (policy.requiresApproval || riskScore >= 0.7)
        ? 'ASK_APPROVAL'
        : riskScore >= 0.58
          ? 'CONTROLLED_EXECUTION'
          : 'ALLOW'
  };

  observability.logEvent(traceId, 'RiskAssessmentEngine', 'RISK_ASSESSED', {
    intent: assessment.intent,
    riskLevel: assessment.riskLevel,
    riskScore: assessment.riskScore,
    contextTrustScore: assessment.contextTrustScore,
    recommendedAction: assessment.recommendedAction
  });

  return assessment;
}

module.exports = {
  assessActionRisk,
  assessContextIntegrity
};
