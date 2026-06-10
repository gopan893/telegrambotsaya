'use strict';

const { clamp } = require('./rag-quality-utils');

const UNCERTAINTY_MARKERS = [
  'i am not sure',
  'i think',
  'possibly',
  'may',
  'might',
  'it seems',
  'based on available',
  'according to',
  'uncertain',
  'not confirmed',
  'no sources found',
  'cannot verify',
  'unverified'
];

const STRONG_CLAIM_PATTERNS = [
  /\bis\s+definitely\b/i,
  /\balways\b/i,
  /\bnever\b/i,
  /\bwill\s+definitely\b/i,
  /\bproven\b/i,
  /\bguaranteed\b/i,
  /\b100%\b/i,
  /\bwithout\s+doubt\b/i
];

function detectHallucination(answer, sources, query) {
  if (!answer || typeof answer !== 'string') {
    return { supported: false, confidence: 0, unsupportedClaims: ['empty_answer'], recommendation: 'reject' };
  }

  const claims = extractClaims(answer);
  const unsupportedClaims = [];
  const supportedClaims = [];

  for (const claim of claims) {
    const support = evaluateClaimSupport(claim, sources, query);
    if (support.supported) {
      supportedClaims.push({ claim, supportScore: support.score });
    } else {
      unsupportedClaims.push({ claim, reason: support.reason });
    }
  }

  const totalClaims = claims.length;
  const supportRatio = totalClaims > 0 ? supportedClaims.length / totalClaims : 0;
  const hasStrongClaims = STRONG_CLAIM_PATTERNS.some(p => p.test(answer));
  const hasUncertaintyMarkers = UNCERTAINTY_MARKERS.some(m => answer.toLowerCase().includes(m));

  let confidence = supportRatio;
  if (hasStrongClaims && supportRatio < 0.8) confidence *= 0.6;
  if (hasUncertaintyMarkers && supportRatio < 0.5) confidence += 0.1;
  confidence = clamp(confidence, 0, 1);

  const recommendation = determineRecommendation(confidence, unsupportedClaims, hasStrongClaims);

  return {
    supported: confidence >= 0.5,
    confidence,
    totalClaims,
    supportedCount: supportedClaims.length,
    unsupportedCount: unsupportedClaims.length,
    unsupportedClaims: unsupportedClaims.map(u => u.claim),
    unsupportedReasons: unsupportedClaims.map(u => u.reason),
    hasStrongClaims,
    hasUncertaintyMarkers,
    recommendation
  };
}

function extractClaims(answer) {
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
  const claims = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (/^(i\s|my\s|we\s|let\s|please|thank|hello|hi)/i.test(trimmed)) continue;
    claims.push(trimmed);
  }
  return claims.length > 0 ? claims : [answer];
}

function evaluateClaimSupport(claim, sources, query) {
  if (!sources || sources.length === 0) {
    return { supported: false, score: 0, reason: 'no_sources_available' };
  }

  const claimTerms = claim.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  let bestScore = 0;

  for (const source of sources) {
    const content = (source.content || source.text || '').toLowerCase();
    let termHits = 0;
    for (const term of claimTerms) {
      if (content.includes(term)) termHits++;
    }
    const termScore = claimTerms.length > 0 ? termHits / claimTerms.length : 0;
    const sourceScore = termScore * 0.6 + (source.score || 0) * 0.4;
    bestScore = Math.max(bestScore, sourceScore);
  }

  return {
    supported: bestScore >= 0.4,
    score: bestScore,
    reason: bestScore >= 0.4 ? 'supported' : 'weak_source_support'
  };
}

function determineRecommendation(confidence, unsupportedClaims, hasStrongClaims) {
  if (confidence >= 0.8) return 'accept';
  if (confidence >= 0.5) return 'accept_with_uncertainty';
  if (unsupportedClaims.length > 0 && hasStrongClaims) return 'add_disclaimer';
  if (unsupportedClaims.length > 2) return 'reject';
  return 'add_uncertainty_markers';
}

function enforceUncertainty(answer, hallucinationResult) {
  if (!hallucinationResult || hallucinationResult.supported) return answer;
  if (hallucinationResult.recommendation === 'accept') return answer;

  let modified = answer;
  if (hallucinationResult.recommendation === 'reject') {
    modified = `I cannot verify this claim with available sources. ${answer}`;
  } else if (hallucinationResult.recommendation === 'add_disclaimer') {
    modified = `Note: Some claims below may not be fully supported by available sources.\n${answer}`;
  } else if (hallucinationResult.recommendation === 'add_uncertainty_markers') {
    modified = `Based on limited sources: ${answer}`;
  }
  return modified;
}

module.exports = { detectHallucination, extractClaims, evaluateClaimSupport, enforceUncertainty, UNCERTAINTY_MARKERS, STRONG_CLAIM_PATTERNS };
