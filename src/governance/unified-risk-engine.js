'use strict';

const DANGER_PATTERNS = [
  /restore.*backup/i, /rollback.*production/i, /rollback.*deploy/i,
  /deploy.*production/i, /github.*push/i, /workflow.*dispatch/i,
  /external.*webhook.*post/i, /gmail.*send/i, /calendar.*(create|update|delete)/i,
  /permission.*change/i, /admin.*change/i, /destructive.*cleanup/i,
  /hard.*delete/i, /shell.*exec/i, /ssh.*connect/i, /termux.*exec/i,
  /direct.*push/i, /force.*push/i
];

const SECRET_PATTERNS = [
  /token/i, /secret/i, /password/i, /api[_-]?key/i,
  /authorization/i, /bearer/i, /DATABASE_URL/i, /REDIS_URL/i,
  /postgresql:\/\//, /rediss:\/\//, /\bsk-\w+/i,
  /\bghp_\w+/i, /\bgithub_pat_\w+/i, /\bgsk_\w+/i,
  /\btvly_\w+/i, /TELEGRAM_TOKEN/i, /GITHUB_TOKEN/i,
  /GOOGLE_CLIENT_SECRET/i, /CLOUDFLARE_API_TOKEN/i, /RENDER_DEPLOY_HOOK/i
];

function classifyGovernanceRisk(action, context) {
  const actionText = typeof action === 'string' ? action : (action && (action.name || action.action || action.description || '')) || '';
  const payloadText = (context && context.payload && typeof context.payload === 'string' ? context.payload : '') ||
    (context && context.message || '');
  const combined = actionText + ' ' + payloadText;

  const actionType = (action && action.actionType) || (context && context.actionType) || 'read';

  if (actionType === 'read' || actionType === 'report') {
    return { riskLevel: 'read_only', riskScore: 0.0, factors: ['READ_ONLY_ACTION'] };
  }

  if (actionType === 'plan' || actionType === 'dry_run') {
    return { riskLevel: 'low', riskScore: 0.15, factors: ['PLAN_OR_DRY_RUN'] };
  }

  if (actionType === 'destructive') {
    return { riskLevel: 'blocked', riskScore: 1.0, factors: ['DESTRUCTIVE_ACTION'], blocked: true };
  }

  if (actionType === 'dangerous') {
    return { riskLevel: 'danger', riskScore: 0.92, factors: ['DANGEROUS_ACTION_TYPE'] };
  }

  for (const pattern of DANGER_PATTERNS) {
    if (pattern.test(combined)) {
      return { riskLevel: 'danger', riskScore: 0.9, factors: ['DANGER_PATTERN_MATCHED'] };
    }
  }

  if (actionType === 'external_write') {
    return { riskLevel: 'high', riskScore: 0.78, factors: ['EXTERNAL_WRITE'] };
  }

  if (actionType === 'internal_write') {
    return { riskLevel: 'medium', riskScore: 0.5, factors: ['INTERNAL_WRITE'] };
  }

  return { riskLevel: 'low', riskScore: 0.15, factors: ['UNCLASSIFIED_ACTION'] };
}

function classifyPayloadRisk(payload) {
  if (!payload) return { riskLevel: 'read_only', riskScore: 0, hasSecret: false, factors: ['NO_PAYLOAD'] };

  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hasSecret = false;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      hasSecret = true;
      break;
    }
  }

  return {
    riskLevel: hasSecret ? 'high' : 'low',
    riskScore: hasSecret ? 0.85 : 0.05,
    hasSecret,
    factors: hasSecret ? ['PAYLOAD_CONTAINS_SECRET'] : ['PAYLOAD_CLEAN']
  };
}

function classifyExternalSystemRisk(action) {
  const externalSystem = (action && action.externalSystem) || '';
  if (!externalSystem) return { riskLevel: 'read_only', riskScore: 0 };

  const systemMap = {
    github: { riskLevel: 'high', riskScore: 0.78 },
    render: { riskLevel: 'danger', riskScore: 0.92 },
    gmail: { riskLevel: 'high', riskScore: 0.78 },
    google_calendar: { riskLevel: 'medium', riskScore: 0.55 },
    webhook: { riskLevel: 'high', riskScore: 0.78 }
  };

  return systemMap[externalSystem] || { riskLevel: 'medium', riskScore: 0.5 };
}

function classifyDataSensitivity(action) {
  const module = (action && action.module) || '';
  const sensitiveModules = ['lifeos', 'knowledge', 'memory'];
  const isSensitive = sensitiveModules.includes(module);

  return {
    sensitive: isSensitive,
    level: isSensitive ? 'high' : 'low',
    module
  };
}

function buildRiskDecision(action, context) {
  const risk = classifyGovernanceRisk(action, context);
  const payloadRisk = classifyPayloadRisk(context && context.payload);
  const externalRisk = classifyExternalSystemRisk(action);

  const combinedScore = Math.max(risk.riskScore, payloadRisk.riskScore, externalRisk.riskScore);
  const combinedLevel = combinedScore >= 0.85 ? 'danger' : combinedScore >= 0.7 ? 'high' : combinedScore >= 0.4 ? 'medium' : combinedScore >= 0.1 ? 'low' : 'read_only';

  return {
    riskLevel: risk.blocked ? 'blocked' : combinedLevel,
    riskScore: Math.round(combinedScore * 100) / 100,
    governanceRisk: risk,
    payloadRisk,
    externalRisk,
    blocked: risk.blocked || false,
    factors: [...new Set([...risk.factors, ...payloadRisk.factors])]
  };
}

module.exports = {
  classifyGovernanceRisk,
  classifyPayloadRisk,
  classifyExternalSystemRisk,
  classifyDataSensitivity,
  buildRiskDecision,
  DANGER_PATTERNS,
  SECRET_PATTERNS
};
