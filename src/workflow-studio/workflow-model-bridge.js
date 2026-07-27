'use strict';

const utils = require('./workflow-utils');

const MODEL_ROUTE_TYPES = ['select', 'fallback', 'benchmark', 'health_check', 'audit'];

function createModelRouteStep(model, params) {
  if (!model) return { ok: false, error: 'Model is required' };
  return {
    ok: true,
    step: {
      id: `model_route_${model}_${Date.now().toString(36)}`,
      type: 'model_route',
      name: `Route to model: ${model}`,
      model,
      params: params || {}
    }
  };
}

function createModelSelectStep(taskType, params) {
  if (!taskType) return { ok: false, error: 'Task type is required' };
  return {
    ok: true,
    step: {
      id: `model_select_${taskType}_${Date.now().toString(36)}`,
      type: 'model_route',
      name: `Select model for: ${taskType}`,
      model: 'auto',
      params: { taskType, action: 'select', ...(params || {}) }
    }
  };
}

function createModelFallbackStep(primaryModel, fallbackModel, params) {
  if (!primaryModel) return { ok: false, error: 'Primary model is required' };
  return {
    ok: true,
    step: {
      id: `model_fallback_${Date.now().toString(36)}`,
      type: 'model_route',
      name: `Model fallback: ${primaryModel} -> ${fallbackModel || 'auto'}`,
      model: primaryModel,
      params: { fallback: fallbackModel || 'auto', action: 'fallback', ...(params || {}) }
    }
  };
}

function createModelBenchmarkStep(model, params) {
  if (!model) return { ok: false, error: 'Model is required' };
  return {
    ok: true,
    step: {
      id: `model_benchmark_${model}_${Date.now().toString(36)}`,
      type: 'analyze',
      name: `Benchmark model: ${model}`,
      source: 'model_router',
      model,
      params: { action: 'benchmark', metrics: ['latency', 'throughput', 'quality'], ...(params || {}) }
    }
  };
}

function createModelHealthCheckStep(model, params) {
  return {
    ok: true,
    step: {
      id: `model_health_${Date.now().toString(36)}`,
      type: 'model_route',
      name: `Model health: ${model || 'all'}`,
      model: model || 'all',
      params: { action: 'health_check', ...(params || {}) }
    }
  };
}

function createModelAuditStep(params) {
  return {
    ok: true,
    step: {
      id: `model_audit_${Date.now().toString(36)}`,
      type: 'analyze',
      name: 'Model Routing Audit',
      source: 'model_router',
      params: { action: 'audit', ...(params || {}) }
    }
  };
}

function createModelNotifyStep(channel, message, params) {
  return {
    ok: true,
    step: {
      id: `model_notify_${Date.now().toString(36)}`,
      type: 'notify',
      name: 'Model Notification',
      channel: channel || 'telegram',
      message: message || '',
      params: params || {}
    }
  };
}

function getModelRouteTypes() {
  return [...MODEL_ROUTE_TYPES];
}

function validateModelParams(model, params) {
  const errors = [];
  if (model && typeof model !== 'string') errors.push('Model must be a string');
  if (model && model.length > 100) errors.push('Model name too long');
  if (params && params.taskType && typeof params.taskType !== 'string') errors.push('taskType must be a string');
  return { valid: errors.length === 0, errors };
}

module.exports = {
  createModelRouteStep, createModelSelectStep,
  createModelFallbackStep, createModelBenchmarkStep,
  createModelHealthCheckStep, createModelAuditStep, createModelNotifyStep,
  getModelRouteTypes, validateModelParams, MODEL_ROUTE_TYPES
};
