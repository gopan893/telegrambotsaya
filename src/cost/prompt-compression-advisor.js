'use strict';

const SAFETY_MARKERS = [
  'jangan kirim', 'jangan expose', 'jangan bagikan', 'rahasia', 'secret', 'token', 'password',
  'do not send', 'do not expose', 'do not share', 'confidential', 'api_key', 'authorization',
  'approval', 'dry-run', 'evaluation', 'executor', 'proposal', 'jangan eksekusi', 'jangan jalankan',
  'do not execute', 'do not run', 'safety', 'security', 'redact', 'redacted'
];

function suggestPromptCompression(text, context, services) {
  if (!text) return { original: '', compressed: '', ratio: 0, preservedSafety: true };
  const original = String(text);
  if (original.length < 200) {
    return { original, compressed: original, ratio: 1, preservedSafety: true, reason: 'already_short' };
  }
  const lines = original.split('\n');
  const compressedLines = [];
  let preservedSafety = true;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isSafetyLine = SAFETY_MARKERS.some(m => trimmed.toLowerCase().includes(m));
    if (isSafetyLine) {
      compressedLines.push(trimmed);
      continue;
    }
    if (trimmed.length > 200) {
      compressedLines.push(trimmed.substring(0, 200) + '...');
    } else {
      compressedLines.push(trimmed);
    }
  }
  const compressed = compressedLines.join('\n');
  const ratio = compressed.length > 0 && original.length > 0 ? compressed.length / original.length : 1;
  return {
    original,
    compressed,
    ratio: Math.round(ratio * 100) / 100,
    preservedSafety: true,
    originalTokens: Math.ceil(original.length / 4),
    compressedTokens: Math.ceil(compressed.length / 4),
    savedTokens: Math.ceil((original.length - compressed.length) / 4)
  };
}

function reduceContextForCost(context, services) {
  if (!context) return { reduced: '', originalLength: 0, reducedLength: 0 };
  if (typeof context === 'string') {
    if (context.length <= 1000) return { reduced: context, originalLength: context.length, reducedLength: context.length, unchanged: true };
    const compressed = suggestPromptCompression(context, null, services);
    return {
      reduced: compressed.compressed,
      originalLength: context.length,
      reducedLength: compressed.compressed.length,
      unchanged: false,
      savedTokens: compressed.savedTokens
    };
  }
  if (Array.isArray(context)) {
    const reduced = context.slice(0, Math.ceil(context.length / 2));
    return {
      reduced,
      originalLength: context.length,
      reducedLength: reduced.length,
      unchanged: reduced.length === context.length
    };
  }
  return { reduced: context, originalLength: 0, reducedLength: 0, unchanged: true };
}

function selectRelevantMemoriesForBudget(memories, budget, services) {
  if (!Array.isArray(memories) || memories.length === 0) return [];
  const maxTokens = (budget && budget.maxContextTokens) || 2000;
  const sorted = [...memories].sort((a, b) => (b.relevance || b.score || 0) - (a.relevance || a.score || 0));
  const selected = [];
  let totalTokens = 0;
  for (const mem of sorted) {
    const memText = mem.content || mem.text || mem.summary || '';
    const memTokens = Math.ceil(memText.length / 4);
    if (totalTokens + memTokens > maxTokens) break;
    selected.push(mem);
    totalTokens += memTokens;
  }
  return selected;
}

function buildCompactAgentPrompt(agentPrompt, services) {
  if (!agentPrompt) return { compact: '', preserved: false };
  const original = typeof agentPrompt === 'string' ? agentPrompt : JSON.stringify(agentPrompt);
  const compressed = suggestPromptCompression(original, null, services);
  return {
    compact: compressed.compressed,
    preserved: compressed.preservedSafety,
    originalTokens: compressed.originalTokens,
    compactTokens: compressed.compressedTokens,
    savedTokens: compressed.savedTokens,
    ratio: compressed.ratio
  };
}

function recommendCheaperWorkflow(workflow, services) {
  if (!workflow) return { recommendation: null };
  const expensiveModel = workflow.model || '';
  const cheapModels = {
    'gpt-4o': 'gpt-4o-mini',
    'gpt-4': 'gpt-4o-mini',
    'mistral-large': 'mistral-small',
    'claude-3-opus': 'claude-3-sonnet',
    'claude-3.5-sonnet': 'claude-3-haiku',
    'gemini-2.0-flash': 'gemini-2.0-flash-lite'
  };
  const suggestedModel = cheapModels[expensiveModel] || null;
  if (!suggestedModel) return { recommendation: null, reason: 'no_cheaper_alternative_known' };
  const savings = workflow.estimatedCost ? workflow.estimatedCost * 0.7 : 'unknown';
  return {
    recommendation: {
      originalModel: expensiveModel,
      suggestedModel,
      reason: `Switching from ${expensiveModel} to ${suggestedModel} can reduce cost.`
    },
    estimatedSavings: savings
  };
}

module.exports = {
  suggestPromptCompression,
  reduceContextForCost,
  selectRelevantMemoriesForBudget,
  buildCompactAgentPrompt,
  recommendCheaperWorkflow
};
