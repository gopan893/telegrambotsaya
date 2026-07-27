'use strict';

const { containsSecret, redactSecrets, confidenceLabel, clamp } = require('./rag-quality-utils');
const store = require('./rag-quality-store');

const SOURCE_AUTHORITY = {
  official_docs: 0.95,
  project_source: 0.9,
  tested_code: 0.85,
  manual_entry: 0.7,
  user_contribution: 0.6,
  external_unverified: 0.3,
  unknown: 0.1,
  deprecated: 0.0
};

const TRUST_SIGNALS = {
  hasAuthor: 0.1,
  hasDate: 0.05,
  hasVersion: 0.05,
  hasUrl: 0.1,
  hasCitation: 0.15,
  isTested: 0.2,
  noSecrets: 0.15,
  consistentMetadata: 0.1
};

function scoreSourceConfidence(source) {
  if (!source || typeof source !== 'object') {
    return { confidence: 'unknown', score: 0, reasons: ['invalid_source'] };
  }

  const reasons = [];
  let baseScore = SOURCE_AUTHORITY[source.authority] || SOURCE_AUTHORITY.unknown;

  if (source.authority) {
    reasons.push(`authority:${source.authority}`);
  }

  for (const [signal, weight] of Object.entries(TRUST_SIGNALS)) {
    if (hasTrustSignal(source, signal)) {
      baseScore += weight;
      reasons.push(`has_${signal}`);
    }
  }

  if (containsSecret(source.content || source.text || '')) {
    baseScore -= 0.3;
    reasons.push('contains_secret_penalized');
  }

  if (source.deprecated) {
    baseScore = 0;
    reasons.push('deprecated');
  }

  const score = clamp(baseScore, 0, 1);
  const level = confidenceLabel(score);

  store.storeConfidenceScore(source.id || source.sourceId, { score, level, reasons });

  return {
    sourceId: source.id || source.sourceId,
    confidence: level,
    score,
    reasons
  };
}

function hasTrustSignal(source, signal) {
  switch (signal) {
    case 'hasAuthor': return Boolean(source.author || source.metadata?.author);
    case 'hasDate': return Boolean(source.date || source.createdAt || source.publishedAt);
    case 'hasVersion': return Boolean(source.version || source.metadata?.version);
    case 'hasUrl': return Boolean(source.url || source.sourceUrl);
    case 'hasCitation': return Boolean(source.citations && source.citations.length > 0);
    case 'isTested': return Boolean(source.tested || source.metadata?.tested);
    case 'noSecrets': return !containsSecret(source.content || source.text || '');
    case 'consistentMetadata': return source.metadata && typeof source.metadata === 'object' && Object.keys(source.metadata).length > 0;
    default: return false;
  }
}

function scoreBatch(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map(s => scoreSourceConfidence(s));
}

function getConfidenceSummary(sources) {
  const scored = scoreBatch(sources);
  const counts = { high: 0, medium: 0, low: 0, unknown: 0, deprecated: 0 };
  for (const s of scored) {
    counts[s.confidence] = (counts[s.confidence] || 0) + 1;
  }
  return {
    total: scored.length,
    counts,
    secretDetected: scored.some(s => s.reasons.includes('contains_secret_penalized'))
  };
}

module.exports = { scoreSourceConfidence, scoreBatch, getConfidenceSummary, hasTrustSignal };
