'use strict';

const utils = require('./workflow-utils');

const RAG_INTENTS = ['search', 'retrieve', 'index', 'analyze_quality', 'feedback'];

function createRagSearchStep(query, params) {
  if (!query) return { ok: false, error: 'Query is required' };
  return {
    ok: true,
    step: {
      id: `rag_search_${Date.now().toString(36)}`,
      type: 'rag_search',
      name: `RAG search: ${(query.length > 40 ? query.slice(0, 40) : query)}`,
      query,
      params: { topK: 5, ...(params || {}) }
    }
  };
}

function createRagRetrieveStep(query, params) {
  if (!query) return { ok: false, error: 'Query is required' };
  return {
    ok: true,
    step: {
      id: `rag_retrieve_${Date.now().toString(36)}`,
      type: 'rag_search',
      name: `RAG retrieve: ${(query.length > 40 ? query.slice(0, 40) : query)}`,
      query,
      params: { intent: 'retrieve', topK: 10, ...(params || {}) }
    }
  };
}

function createRagAnalyzeQualityStep(params) {
  return {
    ok: true,
    step: {
      id: `rag_quality_${Date.now().toString(36)}`,
      type: 'analyze',
      name: 'RAG Quality Analysis',
      source: 'rag',
      params: { metrics: ['relevance', 'hallucination_rate', 'coverage'], ...(params || {}) }
    }
  };
}

function createRagIndexStep(source, params) {
  if (!source) return { ok: false, error: 'Source is required' };
  return {
    ok: true,
    step: {
      id: `rag_index_${Date.now().toString(36)}`,
      type: 'internal_write',
      name: `RAG index: ${source}`,
      target: 'rag',
      params: { action: 'index', source, ...(params || {}) }
    }
  };
}

function createRagFeedbackStep(params) {
  return {
    ok: true,
    step: {
      id: `rag_feedback_${Date.now().toString(36)}`,
      type: 'read',
      name: 'RAG Feedback Collection',
      source: 'rag',
      params: { action: 'feedback', ...(params || {}) }
    }
  };
}

function createRagNotifyStep(channel, message, params) {
  return {
    ok: true,
    step: {
      id: `rag_notify_${Date.now().toString(36)}`,
      type: 'notify',
      name: 'RAG Notification',
      channel: channel || 'telegram',
      message: message || '',
      params: params || {}
    }
  };
}

function createRagSummarizeStep(source, params) {
  return {
    ok: true,
    step: {
      id: `rag_summarize_${Date.now().toString(36)}`,
      type: 'summarize',
      name: 'RAG Summary',
      source: source || 'rag',
      params: { format: 'structured', ...(params || {}) }
    }
  };
}

function getRagIntents() {
  return [...RAG_INTENTS];
}

function validateRagParams(query, params) {
  const errors = [];
  if (query && typeof query !== 'string') errors.push('Query must be a string');
  if (query && query.length > 1000) errors.push('Query too long (max 1000 chars)');
  if (params && params.topK && (typeof params.topK !== 'number' || params.topK < 1 || params.topK > 50)) {
    errors.push('topK must be between 1 and 50');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  createRagSearchStep, createRagRetrieveStep,
  createRagAnalyzeQualityStep, createRagIndexStep,
  createRagFeedbackStep, createRagNotifyStep, createRagSummarizeStep,
  getRagIntents, validateRagParams, RAG_INTENTS
};
