'use strict';

const AVG_CHARS_PER_TOKEN = 4;
const AVG_WORDS_PER_TOKEN = 0.75;

function estimateTokensFromText(text) {
  if (!text) return { tokens: 0, estimated: true, method: 'empty' };
  const charCount = String(text).length;
  const wordCount = String(text).split(/\s+/).filter(Boolean).length;
  const charEstimate = Math.ceil(charCount / AVG_CHARS_PER_TOKEN);
  const wordEstimate = Math.ceil(wordCount / AVG_WORDS_PER_TOKEN);
  return {
    tokens: Math.max(charEstimate, wordEstimate, 1),
    estimated: true,
    method: 'char_word_avg',
    charCount,
    wordCount
  };
}

function estimateTokensFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { tokens: 0, estimated: true, messageCount: 0 };
  }
  let total = 0;
  for (const msg of messages) {
    const content = msg.content || msg.text || '';
    total += estimateTokensFromText(content).tokens;
    if (msg.role) total += 1;
  }
  return { tokens: total, estimated: true, method: 'message_sum', messageCount: messages.length };
}

function estimatePromptTokens(context) {
  if (!context) return { tokens: 0, estimated: true };
  if (typeof context === 'string') return estimateTokensFromText(context);
  if (Array.isArray(context)) return estimateTokensFromMessages(context);
  if (typeof context === 'object') {
    const text = JSON.stringify(context);
    return estimateTokensFromText(text);
  }
  return { tokens: 0, estimated: true };
}

function estimateResponseTokens(requestType) {
  const estimates = {
    simple: 50,
    chat: 150,
    command: 100,
    analysis: 500,
    coding: 800,
    evaluation: 1000,
    report: 2000,
    debate: 1500,
    council: 2000,
    default: 200
  };
  const tokens = estimates[requestType] || estimates.default;
  return { tokens, estimated: true, method: 'request_type', requestType };
}

function estimateWorkflowTokens(workflow) {
  if (!workflow) return { tokens: 0, estimated: true };
  const steps = workflow.steps || [];
  const prompt = workflow.prompt || workflow.description || '';
  const estimatedPrompt = estimateTokensFromText(prompt);
  const stepTokens = steps.reduce((sum, step) => {
    const stepText = step.prompt || step.instruction || step.action || '';
    return sum + estimateTokensFromText(stepText).tokens;
  }, 0);
  return {
    tokens: estimatedPrompt.tokens + stepTokens,
    estimated: true,
    method: 'workflow_estimate',
    steps: steps.length
  };
}

function buildTokenEstimateSummary(estimate) {
  if (!estimate) return { tokens: 0, estimated: true, method: 'none' };
  return {
    tokens: estimate.tokens || 0,
    estimated: estimate.estimated !== false,
    method: estimate.method || 'unknown',
    details: estimate.details || {}
  };
}

module.exports = {
  estimateTokensFromText,
  estimateTokensFromMessages,
  estimatePromptTokens,
  estimateResponseTokens,
  estimateWorkflowTokens,
  buildTokenEstimateSummary
};
