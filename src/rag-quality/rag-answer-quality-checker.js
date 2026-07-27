'use strict';

const { clamp, containsSecret, redactSecrets } = require('./rag-quality-utils');
const hallucinationGuard = require('./hallucination-guard');
const citationLabeler = require('./citation-labeler');

function checkAnswerQuality(answer, sources, query, options = {}) {
  if (!answer || typeof answer !== 'string') {
    return createEmptyResult('no_answer');
  }

  const warnings = [];
  const checks = {};

  checks.grounded = checkGroundedness(answer, sources);
  checks.relevant = checkRelevance(answer, query);
  checks.safe = checkSafety(answer, sources);
  checks.citationsPresent = checkCitations(answer, sources);
  checks.noSecrets = checkNoSecrets(answer);
  checks.uncertaintyAppropriate = checkUncertaintyAppropriate(answer, sources);

  if (!checks.grounded.passed) warnings.push('answer_not_grounded');
  if (!checks.relevant.passed) warnings.push('answer_not_relevant');
  if (!checks.safe.passed) warnings.push('safety_concern');
  if (!checks.citationsPresent.passed) warnings.push('citations_missing');
  if (!checks.noSecrets.passed) warnings.push('secrets_detected');
  if (!checks.uncertaintyAppropriate.passed) warnings.push('uncertainty_inappropriate');

  const hallucination = hallucinationGuard.detectHallucination(answer, sources, query);

  const overallScore = calculateOverallScore(checks, hallucination);

  return {
    answer: answer.slice(0, 200),
    query,
    overallScore,
    passed: overallScore >= 0.6,
    checks,
    hallucination,
    warnings,
    checkedAt: new Date().toISOString()
  };
}

function checkGroundedness(answer, sources) {
  if (!sources || sources.length === 0) {
    return { passed: false, score: 0, detail: 'No sources provided' };
  }
  const answerTerms = answer.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  let maxOverlap = 0;
  for (const source of sources) {
    const content = (source.content || source.text || '').toLowerCase();
    let hits = 0;
    for (const term of answerTerms) {
      if (content.includes(term)) hits++;
    }
    const overlap = answerTerms.length > 0 ? hits / answerTerms.length : 0;
    maxOverlap = Math.max(maxOverlap, overlap);
  }
  const score = clamp(maxOverlap, 0, 1);
  return { passed: score >= 0.3, score, detail: `Max source overlap: ${(score * 100).toFixed(0)}%` };
}

function checkRelevance(answer, query) {
  const queryTerms = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const answerLower = answer.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (answerLower.includes(term)) hits++;
  }
  const score = queryTerms.length > 0 ? hits / queryTerms.length : 0.5;
  return { passed: score >= 0.3, score, detail: `Query term coverage: ${(score * 100).toFixed(0)}%` };
}

function checkSafety(answer, sources) {
  const safetyTerms = ['approve', 'approval', 'danger', 'secret', 'token', 'password', 'api_key'];
  const answerLower = answer.toLowerCase();
  const foundSafety = safetyTerms.filter(t => answerLower.includes(t));
  if (foundSafety.length > 0 && !answerLower.includes('must') && !answerLower.includes('required')) {
    return { passed: false, score: 0.3, detail: `Safety terms found: ${foundSafety.join(', ')}` };
  }
  return { passed: true, score: 1.0, detail: 'No safety concerns detected' };
}

function checkCitations(answer, sources) {
  const hasCitationMarkers = /\[\d+\]|\(.*\d{4}\)|cite|source|reference/i.test(answer);
  const sourceCount = sources ? sources.length : 0;
  if (sourceCount > 0 && !hasCitationMarkers) {
    return { passed: false, score: 0.2, detail: 'Sources available but no citations in answer' };
  }
  if (sourceCount === 0) {
    return { passed: true, score: 0.5, detail: 'No sources to cite' };
  }
  return { passed: true, score: 1.0, detail: 'Citations present' };
}

function checkNoSecrets(answer) {
  if (containsSecret(answer)) {
    const redacted = redactSecrets(answer);
    return { passed: false, score: 0, detail: 'Secrets detected and would be redacted', redacted };
  }
  return { passed: true, score: 1.0, detail: 'No secrets detected' };
}

function checkUncertaintyAppropriate(answer, sources) {
  const hasWeakSources = sources && sources.some(s => (s.score || 0) < 0.3);
  const hasStrongLanguage = /\b(definitely|always|never|guaranteed|100%)\b/i.test(answer);
  if (hasWeakSources && hasStrongLanguage) {
    return { passed: false, score: 0.2, detail: 'Strong language with weak sources' };
  }
  return { passed: true, score: 1.0, detail: 'Uncertainty appropriate' };
}

function calculateOverallScore(checks, hallucination) {
  const checkScores = Object.values(checks).map(c => c.score);
  const hallScore = hallucination ? hallucination.confidence : 0.5;
  const allScores = [...checkScores, hallScore];
  return clamp(allScores.reduce((a, b) => a + b, 0) / allScores.length, 0, 1);
}

function createEmptyResult(reason) {
  return {
    answer: '',
    query: '',
    overallScore: 0,
    passed: false,
    checks: {},
    hallucination: { supported: false, confidence: 0 },
    warnings: [reason],
    checkedAt: new Date().toISOString()
  };
}

function checkBatch(answerSourcePairs, query) {
  if (!Array.isArray(answerSourcePairs)) return [];
  return answerSourcePairs.map(pair => checkAnswerQuality(pair.answer, pair.sources, query));
}

module.exports = { checkAnswerQuality, checkBatch, checkGroundedness, checkRelevance, checkSafety, checkCitations, checkNoSecrets };
