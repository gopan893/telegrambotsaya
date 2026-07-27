'use strict';

const privacyFilter = require('./telegram-privacy-filter');

function buildTelegramContextPack(ctx, intent, services) {
  const context = { user: {}, system: {}, domain: {} };
  if (ctx && ctx.from) {
    context.user = { id: ctx.from.id, username: ctx.from.username, isOwner: ctx.isOwner, isAdmin: ctx.isAdmin };
  }
  context.system = { timestamp: new Date().toISOString(), domain: intent.domain, intent: intent.intent };
  if (intent.domain === 'coding' || intent.domain === 'project') {
    context.domain.projectContext = selectRelevantProjectContext(intent, services);
  }
  if (intent.domain === 'memory' || intent.domain === 'rag') {
    context.domain.memoryContext = selectRelevantMemoryContext(intent, services);
  }
  if (intent.domain === 'workflow') {
    context.domain.workflowContext = selectRelevantWorkflowContext(intent, services);
  }
  if (intent.domain === 'device') {
    context.domain.deviceContext = selectRelevantDeviceContext(intent, services);
  }
  return compressTelegramContext(privacyFilter.filterTelegramPrivateContext(ctx, context, intent, services), services);
}

function selectRelevantProjectContext(intent, services) {
  try {
    if (services && services.getProjectSummary) return services.getProjectSummary();
  } catch (_) {}
  return null;
}

function selectRelevantMemoryContext(intent, services) {
  try {
    if (services && services.getMemoryStatus) return services.getMemoryStatus();
  } catch (_) {}
  return null;
}

function selectRelevantWorkflowContext(intent, services) {
  try {
    if (services && services.getWorkflowSummary) return services.getWorkflowSummary();
  } catch (_) {}
  return null;
}

function selectRelevantDeviceContext(intent, services) {
  try {
    if (services && services.getDeviceStatus) return services.getDeviceStatus();
  } catch (_) {}
  return null;
}

function compressTelegramContext(context, services) {
  if (!context) return {};
  const compressed = { user: context.user, system: context.system };
  if (context.domain && context.domain.projectContext) {
    compressed.domain = { projectContext: context.domain.projectContext };
  }
  return compressed;
}

module.exports = {
  buildTelegramContextPack,
  compressTelegramContext,
  selectRelevantDeviceContext,
  selectRelevantMemoryContext,
  selectRelevantProjectContext,
  selectRelevantWorkflowContext
};
