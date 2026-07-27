'use strict';

const { sanitizeForRag, containsSecret, truncateText, clamp } = require('./rag-quality-utils');

const SAFETY_CONSTRAINTS = {
  neverRemove: [
    'approval_required',
    'secret_redaction',
    'safety_rules',
    'permission_checks',
    'danger_action_gating',
    'privacy_classification'
  ],
  maxCompressionRatio: 0.5,
  preserveCitations: true,
  preserveConfidenceLabels: true
};

function compressContextPack(contextPack, options = {}) {
  if (!contextPack || typeof contextPack !== 'object') {
    return { compressed: '', warnings: ['invalid_context_pack'], rulesPreserved: [] };
  }

  const maxTokens = options.maxTokens || 2000;
  const preserveRules = options.preserveRules !== false;
  const warnings = [];
  const rulesPreserved = [];

  let content = contextPack.content || contextPack.text || '';
  let safetyBlock = contextPack.safetyRules || '';
  let approvalBlock = contextPack.approvalRules || '';

  if (containsSecret(content)) {
    content = sanitizeForRag(content);
    warnings.push('secrets_redacted_during_compression');
  }

  const safetyConstraints = extractSafetyConstraints(contextPack);
  if (safetyConstraints.length > 0 && preserveRules) {
    rulesPreserved.push(...safetyConstraints);
  }

  const estimatedTokens = content.split(/\s+/).length;
  if (estimatedTokens <= maxTokens) {
    return {
      compressed: content,
      originalTokens: estimatedTokens,
      compressedTokens: estimatedTokens,
      compressionRatio: 1,
      warnings,
      rulesPreserved
    };
  }

  const targetTokens = Math.floor(maxTokens * 0.8);
  const sentences = content.split(/(?<=[.!?])\s+/);
  const prioritized = prioritizeSentences(sentences, contextPack.query || '');

  let compressed = '';
  let tokenCount = 0;
  for (const sentence of prioritized) {
    const sentenceTokens = sentence.split(/\s+/).length;
    if (tokenCount + sentenceTokens > targetTokens) break;
    compressed += (compressed ? ' ' : '') + sentence;
    tokenCount += sentenceTokens;
  }

  if (safetyBlock && preserveRules) {
    compressed = `[SAFETY] ${safetyBlock}\n${compressed}`;
    tokenCount += safetyBlock.split(/\s+/).length;
  }
  if (approvalBlock && preserveRules) {
    compressed = `[APPROVAL] ${approvalBlock}\n${compressed}`;
    tokenCount += approvalBlock.split(/\s+/).length;
  }

  compressed = truncateText(compressed, maxTokens * 5);

  return {
    compressed: compressed.trim(),
    originalTokens: estimatedTokens,
    compressedTokens: tokenCount,
    compressionRatio: estimatedTokens > 0 ? clamp(tokenCount / estimatedTokens, 0, 1) : 0,
    warnings,
    rulesPreserved
  };
}

function extractSafetyConstraints(contextPack) {
  const constraints = [];
  const checkFields = [
    'safetyRules', 'approvalRules', 'sensitivity',
    'privacyClassification', 'accessLevel', 'secretRedaction'
  ];
  for (const field of checkFields) {
    if (contextPack[field] !== undefined && contextPack[field] !== null) {
      constraints.push(field);
    }
  }
  if (contextPack.metadata) {
    for (const rule of SAFETY_CONSTRAINTS.neverRemove) {
      if (contextPack.metadata[rule] !== undefined) {
        constraints.push(rule);
      }
    }
  }
  return constraints;
}

function prioritizeSentences(sentences, query) {
  const queryTerms = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return sentences
    .map(s => ({
      text: s,
      priority: calculateSentencePriority(s, queryTerms)
    }))
    .sort((a, b) => b.priority - a.priority)
    .map(s => s.text);
}

function calculateSentencePriority(sentence, queryTerms) {
  let priority = 0;
  const lower = sentence.toLowerCase();
  for (const term of queryTerms) {
    if (lower.includes(term)) priority += 2;
  }
  if (/\b(approval|safety|secret|redact|privacy|sensitivity)\b/.test(lower)) priority += 5;
  if (/\b(code|function|api|endpoint)\b/.test(lower)) priority += 1;
  if (/^\[/.test(sentence.trim())) priority += 3;
  return priority;
}

function compressBatch(packs, options) {
  if (!Array.isArray(packs)) return [];
  return packs.map(p => compressContextPack(p, options));
}

module.exports = { compressContextPack, compressBatch, SAFETY_CONSTRAINTS, extractSafetyConstraints };
