'use strict';

let capabilities = [];
let capabilityIndex = { byId: {}, byModule: {}, byActionType: {} };

const MODULES = [
  'telegram_control', 'agents', 'executor', 'integrations', 'coding',
  'routines', 'selfhealing', 'autohealing', 'monitoring', 'cicd',
  'githubops', 'deploy', 'observability', 'cost', 'operator',
  'portfolio', 'knowledge', 'lifeos', 'operating_loop', 'improvement',
  'backup', 'memory', 'goals', 'workflows'
];

const ACTION_TYPES = [
  'read', 'report', 'plan', 'dry_run', 'proposal',
  'internal_write', 'external_read', 'external_write',
  'dangerous', 'destructive'
];

function generateId(module, name) {
  return `${module}.${name}`.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

function registerCapability(capability) {
  if (!capability || !capability.module || !capability.name) {
    throw new Error('Capability must have module and name');
  }

  const id = capability.id || generateId(capability.module, capability.name);
  const existing = capabilities.find(c => c.id === id);
  if (existing) {
    Object.assign(existing, capability, { id, updatedAt: new Date().toISOString() });
    rebuildIndex();
    return existing;
  }

  const entry = {
    id,
    module: capability.module,
    name: capability.name,
    description: capability.description || '',
    actionType: capability.actionType || 'read',
    riskLevel: capability.riskLevel || 'low',
    externalSystem: capability.externalSystem || null,
    requiresOwner: capability.requiresOwner || false,
    requiresAdmin: capability.requiresAdmin || false,
    requiresEvaluation: capability.requiresEvaluation || false,
    requiresExecutorApproval: capability.requiresExecutorApproval || false,
    requiresSecretScan: capability.requiresSecretScan || false,
    requiresCostGuard: capability.requiresCostGuard || false,
    enabled: capability.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  capabilities.push(entry);
  rebuildIndex();
  return entry;
}

function getCapability(capabilityId) {
  return capabilityIndex.byId[capabilityId] || null;
}

function listCapabilities(filters) {
  let result = [...capabilities];
  if (filters) {
    if (filters.module) result = result.filter(c => c.module === filters.module);
    if (filters.actionType) result = result.filter(c => c.actionType === filters.actionType);
    if (filters.riskLevel) result = result.filter(c => c.riskLevel === filters.riskLevel);
    if (filters.enabled !== undefined) result = result.filter(c => c.enabled === !!filters.enabled);
    if (filters.externalSystem) result = result.filter(c => c.externalSystem === filters.externalSystem);
  }
  return result;
}

function findCapabilityByAction(action) {
  const key = action.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return capabilityIndex.byId[key] ||
    capabilities.find(c => key.includes(c.id) || key.includes(c.name.toLowerCase().replace(/[^a-z0-9._-]/g, '_'))) ||
    null;
}

function registerDefaultCapabilities() {
  const defaults = [
    { module: 'telegram_control', name: 'message.read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'telegram_control', name: 'command.execute', actionType: 'read', riskLevel: 'low' },
    { module: 'telegram_control', name: 'admin.command', actionType: 'internal_write', riskLevel: 'medium', requiresAdmin: true },
    { module: 'agents', name: 'orchestrate', actionType: 'read', riskLevel: 'low' },
    { module: 'agents', name: 'delegate', actionType: 'internal_write', riskLevel: 'medium' },
    { module: 'executor', name: 'proposal.create', actionType: 'proposal', riskLevel: 'low' },
    { module: 'executor', name: 'proposal.approve', actionType: 'internal_write', riskLevel: 'high', requiresAdmin: true },
    { module: 'executor', name: 'proposal.run', actionType: 'internal_write', riskLevel: 'high', requiresAdmin: true, requiresEvaluation: true },
    { module: 'integrations', name: 'weather.read', actionType: 'external_read', riskLevel: 'low' },
    { module: 'integrations', name: 'search.read', actionType: 'external_read', riskLevel: 'low' },
    { module: 'githubops', name: 'status.read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'githubops', name: 'push.propose', actionType: 'external_write', riskLevel: 'high', requiresEvaluation: true, requiresExecutorApproval: true, requiresSecretScan: true, externalSystem: 'github' },
    { module: 'githubops', name: 'workflow.propose', actionType: 'external_write', riskLevel: 'high', requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'github' },
    { module: 'githubops', name: 'issue.propose', actionType: 'external_write', riskLevel: 'medium', requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'github' },
    { module: 'githubops', name: 'pr.propose', actionType: 'external_write', riskLevel: 'high', requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'github' },
    { module: 'githubops', name: 'comment.propose', actionType: 'external_write', riskLevel: 'medium', requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'github' },
    { module: 'deploy', name: 'status.read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'deploy', name: 'deploy.propose', actionType: 'external_write', riskLevel: 'danger', requiresOwner: true, requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'render' },
    { module: 'deploy', name: 'rollback.propose', actionType: 'dangerous', riskLevel: 'danger', requiresOwner: true, requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'render' },
    { module: 'deploy', name: 'env.read', actionType: 'read', riskLevel: 'medium', requiresAdmin: true },
    { module: 'gmail', name: 'draft.propose', actionType: 'external_write', riskLevel: 'medium', requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'gmail' },
    { module: 'gmail', name: 'send', actionType: 'external_write', riskLevel: 'high', enabled: false, requiresOwner: true, requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'gmail' },
    { module: 'calendar', name: 'events.read', actionType: 'external_read', riskLevel: 'low' },
    { module: 'calendar', name: 'event.propose', actionType: 'external_write', riskLevel: 'medium', requiresEvaluation: true, requiresExecutorApproval: true, externalSystem: 'google_calendar' },
    { module: 'webhook', name: 'preview', actionType: 'dry_run', riskLevel: 'low' },
    { module: 'webhook', name: 'post.propose', actionType: 'external_write', riskLevel: 'high', requiresEvaluation: true, requiresExecutorApproval: true, requiresSecretScan: true },
    { module: 'backup', name: 'create.propose', actionType: 'proposal', riskLevel: 'medium', requiresEvaluation: true },
    { module: 'backup', name: 'restore.propose', actionType: 'dangerous', riskLevel: 'danger', requiresOwner: true, requiresEvaluation: true, requiresExecutorApproval: true },
    { module: 'memory', name: 'write.safe', actionType: 'internal_write', riskLevel: 'low', requiresSecretScan: true },
    { module: 'memory', name: 'delete', actionType: 'internal_write', riskLevel: 'high', enabled: false, requiresOwner: true },
    { module: 'memory', name: 'archive', actionType: 'internal_write', riskLevel: 'medium' },
    { module: 'knowledge', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'knowledge', name: 'write.safe', actionType: 'internal_write', riskLevel: 'low', requiresSecretScan: true },
    { module: 'lifeos', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'lifeos', name: 'write.personal', actionType: 'internal_write', riskLevel: 'medium', requiresOwner: true, requiresSecretScan: true },
    { module: 'operating_loop', name: 'readonly.run', actionType: 'read', riskLevel: 'read_only' },
    { module: 'operating_loop', name: 'proposal.create', actionType: 'proposal', riskLevel: 'medium' },
    { module: 'operating_loop', name: 'external.run', actionType: 'external_write', riskLevel: 'high', enabled: false, requiresEvaluation: true, requiresExecutorApproval: true },
    { module: 'improvement', name: 'plan.create', actionType: 'plan', riskLevel: 'low' },
    { module: 'improvement', name: 'prompt.generate', actionType: 'report', riskLevel: 'low' },
    { module: 'improvement', name: 'code.patch', actionType: 'external_write', riskLevel: 'high', enabled: false, requiresOwner: true, requiresEvaluation: true },
    { module: 'observability', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'cost', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'operator', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'portfolio', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'cicd', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'selfhealing', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'selfhealing', name: 'repair.propose', actionType: 'internal_write', riskLevel: 'high', requiresEvaluation: true, requiresExecutorApproval: true },
    { module: 'autohealing', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'monitoring', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'coding', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'routines', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'goals', name: 'read', actionType: 'read', riskLevel: 'read_only' },
    { module: 'workflows', name: 'read', actionType: 'read', riskLevel: 'read_only' }
  ];

  for (const cap of defaults) {
    registerCapability(cap);
  }
}

function rebuildIndex() {
  capabilityIndex = { byId: {}, byModule: {}, byActionType: {} };
  for (const cap of capabilities) {
    capabilityIndex.byId[cap.id] = cap;
    if (!capabilityIndex.byModule[cap.module]) capabilityIndex.byModule[cap.module] = [];
    capabilityIndex.byModule[cap.module].push(cap);
    if (!capabilityIndex.byActionType[cap.actionType]) capabilityIndex.byActionType[cap.actionType] = [];
    capabilityIndex.byActionType[cap.actionType].push(cap);
  }
}

function validateCapabilityRegistry() {
  const errors = [];
  const modulesFound = new Set(capabilities.map(c => c.module));
  for (const mod of MODULES) {
    if (!modulesFound.has(mod)) {
      errors.push(`Missing module: ${mod}`);
    }
  }
  for (const cap of capabilities) {
    if (!ACTION_TYPES.includes(cap.actionType)) {
      errors.push(`Invalid actionType "${cap.actionType}" for ${cap.id}`);
    }
    if (cap.requiresSecretScan && cap.riskLevel === 'read_only') {
      errors.push(`Secret scan on read-only capability ${cap.id}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function buildCapabilityIndex() {
  return {
    byModule: { ...capabilityIndex.byModule },
    byActionType: { ...capabilityIndex.byActionType },
    totalCapabilities: capabilities.length
  };
}

function resetRegistry() {
  capabilities = [];
  capabilityIndex = { byId: {}, byModule: {}, byActionType: {} };
}

registerDefaultCapabilities();

module.exports = {
  registerCapability,
  getCapability,
  listCapabilities,
  findCapabilityByAction,
  validateCapabilityRegistry,
  buildCapabilityIndex,
  resetRegistry,
  MODULES,
  ACTION_TYPES
};
