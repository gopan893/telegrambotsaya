'use strict';

const store = require('./model-router-store');
const utils = require('./model-router-utils');
const taskClassifier = require('./task-model-classifier');
const privacyPolicy = require('./privacy-aware-routing-policy');
const costPolicy = require('./cost-aware-routing-policy');
const fallbackManager = require('./model-fallback-manager');
const providerRegistry = require('./model-provider-registry');
const capabilityRegistry = require('./model-capability-registry');

async function selectModelRoute(input = {}, context = {}, services = {}) {
  const taskClass = taskClassifier.classifyModelTask(input.text || input.query || '', context, services);
  const complexity = taskClassifier.estimateTaskComplexity(input.text || input.query || '', services);
  const task = { input: input.text || input.query || '', class: taskClass, complexity };
  const privacy = privacyPolicy.evaluateModelPrivacyPolicy(task, context, services);
  const blocked = privacyPolicy.blockUnsafeModelRouting(task, context, services);
  if (blocked.blocked) return { route: null, blocked: true, reason: blocked.reason, taskClass };

  const providers = await providerRegistry.listProviders({}, services);
  const candidates = providers.filter(p => {
    if (p.type === 'fallback') return false;
    if (!fallbackManager.isEnabled(p, services)) return false;
    if (privacy.localPreferred && p.type !== 'local') return false;
    return true;
  });

  const costEval = costPolicy.evaluateModelCostPolicy(task, context, services);
  let selected = candidates.find(p => p.type === 'local');
  if (!selected && !privacy.localPreferred) {
    if (costEval.economyPreferred) selected = candidates.find(p => p.costTier === 'low' && p.type !== 'local') || candidates[0];
    else selected = candidates.find(p => p.costTier === 'high' || p.costTier === 'medium') || candidates[0];
  }
  if (!selected) selected = providers.find(p => p.type === 'fallback') || { id: 'fallback_stub', name: 'Fallback Stub', type: 'fallback' };

  const costRoute = costPolicy.requireApprovalForHighCostRoute({ provider: selected.name, costTier: selected.costTier, estimatedTokens: input.text?.length || 100 }, services);
  const capabilities = await capabilityRegistry.listCapabilities({ providerId: selected.id }, services);

  const decision = {
    id: utils.createId('route'),
    taskClass,
    selectedProvider: selected.id,
    selectedProviderName: selected.name,
    selectedModel: capabilities[0]?.modelName || 'default',
    routeType: selected.type,
    privacyDecision: privacy.localPreferred ? 'local_preferred' : 'cloud_allowed',
    costDecision: costEval.economyPreferred ? 'economy' : 'quality',
    qualityReason: complexity === 'high' ? 'Complex task needs quality model' : 'Routine task',
    costWarning: costRoute.requiresApproval ? costRoute.reason : null,
    fallbackChain: [],
    redactionsApplied: privacy.redactionNeeded,
    createdAt: new Date().toISOString()
  };

  const s = await store.loadModelStore(services);
  s.decisions.push(decision);
  await store.saveModelStore(s, services);
  return decision;
}

function buildModelRoutingDecision(task = {}, candidates = [], policies = {}, services = {}) {
  return { task, candidates, policies, summary: `Task: ${task.class}. ${candidates.length} candidates evaluated.` };
}

function explainModelRoute(decision = {}, services = {}) {
  const parts = [`Route: ${decision.selectedProviderName || decision.selectedProvider} (${decision.routeType})`, `Task class: ${decision.taskClass}`, `Privacy: ${decision.privacyDecision}`, `Cost: ${decision.costDecision}`];
  if (decision.costWarning) parts.push(`Cost warning: ${decision.costWarning}`);
  if (decision.redactionsApplied) parts.push('Redactions applied for cloud safety.');
  return parts.join(' | ');
}

async function recordModelRouteDecision(decision = {}, services = {}) {
  const s = await store.loadModelStore(services);
  s.decisions.push({ ...decision, recordedAt: new Date().toISOString() });
  await store.saveModelStore(s, services);
  return decision;
}

module.exports = { selectModelRoute, buildModelRoutingDecision, explainModelRoute, recordModelRouteDecision };
