'use strict';

const utils = require('./knowledge-utils');

const CRITICAL_TOKENS = [
  'node.js 20', 'commonjs', 'vanilla dashboard', 'typescript',
  'react', 'next', 'vue', 'shell executor', 'autonomous',
  'auto-approve', 'auto-run', 'approval', 'git push', 'deploy',
  'rollback', 'secret', 'fallback', 'overview', 'service worker'
];

function classifyMemoryCandidate(input = {}, services = {}) {
  if (!input || typeof input !== 'object') {
    return { category: 'unknown', reason: 'invalid_input', score: 0 };
  }
  const type = String(input.type || '').toLowerCase();
  const text = `${input.title || ''} ${input.summary || ''}`.toLowerCase();
  const tags = (input.tags || []).map(t => String(t).toLowerCase());
  let category = 'general';
  if (['project', 'phase', 'goal', 'plan', 'roadmap'].includes(type)) category = 'project';
  else if (['decision', 'policy', 'constraint', 'rule'].includes(type) || tags.includes('decision')) category = 'decision';
  else if (['incident', 'bug', 'fix', 'post-mortem'].includes(type) || tags.includes('incident')) category = 'incident';
  else if (['deploy', 'rollback', 'release'].includes(type)) category = 'deployment';
  else if (type === 'agent' || tags.includes('agent')) category = 'agent';
  else if (type === 'doc' || tags.includes('documentation')) category = 'documentation';
  else if (type === 'risk' || tags.includes('risk')) category = 'risk';
  else if (type === 'cost' || tags.includes('cost')) category = 'cost';
  const criticalScore = CRITICAL_TOKENS.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
  const score = Math.min(1, criticalScore / 6);
  return { category, reason: `type=${type}`, score, criticalScore };
}

function decideMemoryScope(input = {}, services = {}) {
  const classification = classifyMemoryCandidate(input, services);
  const map = {
    project: 'project_memory',
    decision: 'decision_memory',
    incident: 'incident_memory',
    deployment: 'deployment_memory',
    agent: 'agent_memory',
    documentation: 'documentation_memory',
    risk: 'project_memory',
    cost: 'project_memory',
    general: 'project_memory'
  };
  return map[classification.category] || 'project_memory';
}

function decideMemorySensitivity(input = {}, services = {}) {
  if (!input || typeof input !== 'object') return 'internal';
  if (input.sensitivity && utils.isValidSensitivity(input.sensitivity) && input.sensitivity !== 'secret') {
    return input.sensitivity;
  }
  const text = `${input.title || ''} ${input.summary || ''}`.toLowerCase();
  const secretCheck = utils.detectSecretInText(text);
  if (secretCheck.found) return 'secret';
  if (text.includes('public') || text.includes('open source')) return 'public';
  if (text.includes('confidential') || text.includes('internal only')) return 'confidential';
  return 'internal';
}

function decideMemoryRetention(input = {}, services = {}) {
  if (!input || typeof input !== 'object') return 'temporary';
  const sensitivity = decideMemorySensitivity(input, services);
  if (sensitivity === 'secret') return 'blocked';
  if (input.retention && utils.isValidRetention(input.retention)) return input.retention;
  const type = String(input.type || '').toLowerCase();
  if (type === 'phase' || type === 'project' || type === 'decision') return 'active';
  if (type === 'incident' || type === 'deploy') return 'active';
  if (input.status === 'archived') return 'archive';
  if (input.source === 'ephemeral' || input.scope === 'temporary_chat') return 'temporary';
  return 'active';
}

function buildMemoryGovernanceDecision(input = {}, services = {}) {
  const classification = classifyMemoryCandidate(input, services);
  const scope = decideMemoryScope(input, services);
  const sensitivity = decideMemorySensitivity(input, services);
  const retention = decideMemoryRetention(input, services);
  const blocked = sensitivity === 'secret' || retention === 'blocked';
  const decision = {
    input: { type: input.type || null, source: input.source || null },
    classification,
    scope,
    sensitivity,
    retention,
    blocked,
    reason: blocked ? 'secret_detected' : `category=${classification.category}`,
    canStore: !blocked,
    canRetrieve: sensitivity !== 'secret',
    canShare: sensitivity === 'public' || sensitivity === 'internal',
    generatedAt: utils.nowIso()
  };
  return decision;
}

module.exports = {
  classifyMemoryCandidate,
  decideMemoryScope,
  decideMemorySensitivity,
  decideMemoryRetention,
  buildMemoryGovernanceDecision
};
