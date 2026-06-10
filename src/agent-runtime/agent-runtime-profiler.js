'use strict';

const store = require('./agent-runtime-store');
const utils = require('./agent-runtime-utils');

function profileTaskExecution(task = {}, result = {}, services = {}) {
  const inputText = String(task.input || task.description || '');
  return {
    id: utils.createId('prof'),
    taskId: task.id || utils.createId('task'),
    agentId: task.assignedAgentId || result.agentId || 'unknown',
    taskType: task.type || 'unknown',
    taskClass: task.class || task.taskClass || 'unknown',
    complexity: task.complexity || 'low',
    modelUsed: result.modelUsed || result.selectedModel || 'unknown',
    providerUsed: result.providerUsed || result.selectedProvider || 'unknown',
    routeType: result.routeType || 'unknown',
    latencyMs: result.latencyMs || result.durationMs || 0,
    tokenCount: result.tokenCount || result.totalTokens || 0,
    costEstimate: result.costEstimate || result.cost || 0,
    qualityScore: result.qualityScore || null,
    inputLength: inputText.length,
    isPrivate: task.class === 'private_lifeos' || task.sensitivity === 'high',
    success: result.success !== false,
    errorMessage: result.error || null,
    recordedAt: new Date().toISOString()
  };
}

async function recordProfile(profile, services = {}) {
  const safe = { ...profile };
  if (safe.isPrivate) {
    safe.inputLength = 0;
    safe.taskInputPreview = '[PRIVATE_DATA_REDACTED]';
  }
  return store.addRecord('profiles', safe, services);
}

async function getProfilesByAgent(agentId, services = {}) {
  return store.getRecords('profiles', p => p.agentId === agentId, services);
}

async function getProfilesByTaskType(taskType, services = {}) {
  return store.getRecords('profiles', p => p.taskType === taskType, services);
}

async function getRecentProfiles(limit = 50, services = {}) {
  const all = await store.getRecords('profiles', null, services);
  return all.slice(-limit);
}

function summarizeProfiles(profiles = []) {
  if (!profiles.length) return { count: 0, avgLatency: 0, avgCost: 0, avgQuality: 0, totalCost: 0 };
  const totalLatency = profiles.reduce((s, p) => s + (p.latencyMs || 0), 0);
  const totalCost = profiles.reduce((s, p) => s + (p.costEstimate || 0), 0);
  const qualities = profiles.filter(p => p.qualityScore != null);
  const avgQuality = qualities.length ? qualities.reduce((s, p) => s + p.qualityScore, 0) / qualities.length : 0;
  return {
    count: profiles.length,
    avgLatency: Math.round(totalLatency / profiles.length),
    avgCost: +(totalCost / profiles.length).toFixed(6),
    avgQuality: +avgQuality.toFixed(2),
    totalCost: +totalCost.toFixed(6),
    successRate: +(profiles.filter(p => p.success).length / profiles.length).toFixed(2)
  };
}

module.exports = { profileTaskExecution, recordProfile, getProfilesByAgent, getProfilesByTaskType, getRecentProfiles, summarizeProfiles };
