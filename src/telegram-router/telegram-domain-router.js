'use strict';

const intentClassifier = require('./telegram-intent-classifier');
const riskDetector = require('./telegram-risk-detector');
const privacyFilter = require('./telegram-privacy-filter');
const contextBuilder = require('./telegram-context-builder');
const agentSelector = require('./telegram-agent-selector');

async function routeTelegramMessageByDomain(ctx, intent, services) {
  const domain = intent.domain || 'normal_chat';
  const text = ctx.text || '';
  const riskReport = riskDetector.detectTelegramActionRisk(text, intent, services);
  if (riskReport.isDangerous) {
    return routeDangerous(ctx, intent, riskReport, services);
  }
  const filteredContext = privacyFilter.filterTelegramPrivateContext(ctx, {}, intent, services);
  const domainMap = {
    normal_chat: routeNormalChat,
    coding: routeCoding,
    project: routeProject,
    ops: routeOps,
    deploy: routeDeploy,
    security: routeSecurity,
    privacy: routePrivacy,
    memory: routeMemory,
    rag: routeMemory,
    workflow: routeWorkflow,
    device: routeDevice,
    approval: routeApproval,
    research: routeResearch,
    cost: routeCost,
    model_strategy: routeModelStrategy,
    troubleshooting: routeTroubleshooting,
    dashboard: routeDashboard
  };
  const handler = domainMap[domain] || routeNormalChat;
  return handler(ctx, intent, services, filteredContext);
}

async function routeNormalChat(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'normal_chat',
    agent: agent,
    response: null,
    passThrough: true,
    isNatural: true,
    explanation: null
  };
}

async function routeCoding(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'coding',
    agent: agent,
    response: 'Saya akan tangani ini sebagai tugas coding.',
    passThrough: true,
    isNatural: true,
    explanation: 'Saya akan tangani ini sebagai tugas coding.'
  };
}

async function routeProject(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'project',
    agent: agent,
    response: 'Saya akan lihat project Anda.',
    passThrough: true,
    isNatural: true,
    explanation: 'Saya akan lihat project Anda.'
  };
}

async function routeOps(ctx, intent, services, filteredContext) {
  const riskReport = riskDetector.detectTelegramActionRisk(ctx.text, intent, services);
  if (riskReport.isDangerous) {
    return routeDangerous(ctx, intent, riskReport, services);
  }
  return {
    handled: true,
    domain: 'ops',
    agent: 'ops',
    response: 'Memeriksa status operasional...',
    passThrough: true,
    isNatural: true
  };
}

async function routeDeploy(ctx, intent, services, filteredContext) {
  const riskReport = riskDetector.detectTelegramActionRisk(ctx.text, intent, services);
  if (riskReport.isDangerous) {
    return routeDangerous(ctx, intent, riskReport, services);
  }
  return {
    handled: true,
    domain: 'deploy',
    agent: 'ops',
    response: 'Tidak dapat mengeksekusi deploy langsung. Silakan buat proposal.',
    passThrough: false,
    isNatural: false,
    action: 'propose_deploy'
  };
}

async function routeSecurity(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'security',
    agent: agent,
    response: 'Memeriksa keamanan...',
    passThrough: true,
    isNatural: true
  };
}

async function routePrivacy(ctx, intent, services, filteredContext) {
  return {
    handled: true,
    domain: 'privacy',
    agent: 'privacy',
    response: 'Permintaan privasi akan diproses dengan aman.',
    passThrough: true,
    isNatural: true,
    requiresApproval: true,
    ownerOnly: true
  };
}

async function routeMemory(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'memory',
    agent: agent,
    response: null,
    passThrough: true,
    isNatural: true
  };
}

async function routeWorkflow(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'workflow',
    agent: agent,
    response: 'Membuat draft workflow...',
    passThrough: true,
    isNatural: true
  };
}

async function routeDevice(ctx, intent, services, filteredContext) {
  const riskReport = riskDetector.detectTelegramActionRisk(ctx.text, intent, services);
  if (riskReport.isDangerous) {
    return routeDangerous(ctx, intent, riskReport, services);
  }
  return {
    handled: true,
    domain: 'device',
    agent: 'device',
    response: null,
    passThrough: true,
    isNatural: true
  };
}

async function routeApproval(ctx, intent, services, filteredContext) {
  return {
    handled: true,
    domain: 'approval',
    agent: 'general',
    response: 'Memeriksa proposal...',
    passThrough: true,
    isNatural: true,
    requiresPermission: true,
    ownerOnly: true
  };
}

async function routeResearch(ctx, intent, services, filteredContext) {
  const agent = agentSelector.selectAgentForTelegramIntent(intent, services);
  return {
    handled: true,
    domain: 'research',
    agent: agent,
    response: 'Melakukan research...',
    passThrough: true,
    isNatural: true
  };
}

async function routeCost(ctx, intent, services, filteredContext) {
  return {
    handled: true,
    domain: 'cost',
    agent: 'general',
    response: 'Memeriksa biaya dan usage...',
    passThrough: true,
    isNatural: true
  };
}

async function routeModelStrategy(ctx, intent, services, filteredContext) {
  return {
    handled: true,
    domain: 'model_strategy',
    agent: 'general',
    response: 'Memeriksa strategi model...',
    passThrough: true,
    isNatural: true
  };
}

async function routeTroubleshooting(ctx, intent, services, filteredContext) {
  return {
    handled: true,
    domain: 'troubleshooting',
    agent: 'general',
    response: null,
    passThrough: true,
    isNatural: true
  };
}

async function routeDashboard(ctx, intent, services, filteredContext) {
  return {
    handled: true,
    domain: 'dashboard',
    agent: 'general',
    response: 'Informasi dashboard...',
    passThrough: true,
    isNatural: true
  };
}

async function routeDangerous(ctx, intent, riskReport, services) {
  return {
    handled: true,
    domain: 'dangerous',
    agent: 'security',
    response: '⚠️ Tindakan ini memerlukan proposal dan approval.\n\n' + riskReport.explanation,
    passThrough: false,
    isNatural: false,
    requiresApproval: true,
    requiresEvaluation: true,
    riskReport: riskReport,
    dangerousAction: true
  };
}

module.exports = {
  routeTelegramMessageByDomain,
  routeNormalChat,
  routeCoding,
  routeProject,
  routeOps,
  routeDeploy,
  routeSecurity,
  routePrivacy,
  routeMemory,
  routeWorkflow,
  routeDevice,
  routeApproval,
  routeResearch,
  routeCost,
  routeModelStrategy,
  routeTroubleshooting,
  routeDashboard,
  routeDangerous
};
