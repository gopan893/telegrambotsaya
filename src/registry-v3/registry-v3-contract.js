/**
 * Registry v3 Contract
 * Defines the unified registry v3 item contract
 */

const utils = require('./registry-v3-utils');

function createEmptyRegistryV3Item() {
  return {
    id: null,
    version: '3.0.0',
    type: null,
    module: null,
    title: null,
    description: null,
    canonicalId: null,
    aliases: [],
    status: 'draft',
    visibility: 'internal',
    riskLevel: 'low',
    requiresAuth: false,
    requiresOwner: false,
    requiresAdmin: false,
    requiresApproval: false,
    requiresEvaluation: false,
    directRunAllowed: true,
    ownerOnly: false,
    enabled: true,
    compatibility: {},
    docs: null,
    tests: null,
    createdAt: null,
    updatedAt: null
  };
}

function createRegistryV3Item(input) {
  const item = createEmptyRegistryV3Item();

  if (!input) return item;

  // Core identifiers
  item.id = utils.normalizeId(input.id) || utils.generateRegistryId();
  item.type = input.type || 'module';
  item.module = input.module || null;
  item.canonicalId = input.canonicalId || utils.normalizeCanonicalId(item.id, item.type);

  // Metadata
  item.title = input.title || item.id;
  item.description = input.description || null;
  item.aliases = Array.isArray(input.aliases) ? input.aliases : [];

  // Status and visibility
  item.status = utils.isValidStatus(input.status) ? input.status : 'draft';
  item.visibility = utils.isValidVisibility(input.visibility) ? input.visibility : 'internal';
  item.riskLevel = utils.isValidRiskLevel(input.riskLevel) ? input.riskLevel : 'low';

  // Security and authorization
  item.requiresAuth = Boolean(input.requiresAuth);
  item.requiresOwner = Boolean(input.requiresOwner);
  item.requiresAdmin = Boolean(input.requiresAdmin);
  item.requiresApproval = input.requiresApproval !== undefined
    ? Boolean(input.requiresApproval)
    : utils.requiresApprovalByDefault(item);
  item.requiresEvaluation = Boolean(input.requiresEvaluation);
  item.ownerOnly = Boolean(input.ownerOnly);

  // Execution control
  item.directRunAllowed = input.directRunAllowed !== undefined
    ? Boolean(input.directRunAllowed)
    : !utils.isDangerousActionType(input.actionType);

  item.enabled = input.enabled !== undefined ? Boolean(input.enabled) : true;

  // Documentation and compatibility
  item.compatibility = input.compatibility || {};
  item.docs = input.docs || null;
  item.tests = input.tests || null;

  // Timestamps
  item.createdAt = input.createdAt || new Date().toISOString();
  item.updatedAt = new Date().toISOString();

  return item;
}

function validateRegistryV3ItemContract(item) {
  const errors = [];
  const warnings = [];

  if (!item) {
    errors.push('Item is null or undefined');
    return { valid: false, errors, warnings };
  }

  // Validate required fields
  if (!item.id || !utils.isValidId(item.id)) {
    errors.push(`Invalid id: ${item.id}`);
  }

  if (!item.type || !utils.isValidType(item.type)) {
    errors.push(`Invalid type: ${item.type}`);
  }

  if (!item.canonicalId) {
    errors.push('Missing canonicalId');
  }

  if (!item.title) {
    warnings.push('Missing title');
  }

  if (!item.description) {
    warnings.push('Missing description');
  }

  // Validate status and visibility
  if (!utils.isValidStatus(item.status)) {
    errors.push(`Invalid status: ${item.status}`);
  }

  if (!utils.isValidVisibility(item.visibility)) {
    errors.push(`Invalid visibility: ${item.visibility}`);
  }

  if (!utils.isValidRiskLevel(item.riskLevel)) {
    errors.push(`Invalid riskLevel: ${item.riskLevel}`);
  }

  // Validate security rules
  if (item.riskLevel === 'critical' && item.directRunAllowed) {
    errors.push('Critical risk items cannot have directRunAllowed=true');
  }

  if (item.riskLevel === 'high' && item.directRunAllowed && !item.requiresApproval) {
    warnings.push('High risk items with directRunAllowed should require approval');
  }

  if (item.visibility === 'public' && item.requiresAuth) {
    warnings.push('Public items should not require auth (conflicts with visibility)');
  }

  if (item.ownerOnly && !item.requiresOwner && !item.requiresAdmin) {
    warnings.push('ownerOnly items should set requiresOwner or requiresAdmin');
  }

  // Validate documentation for active items
  if (item.status === 'active') {
    if (!item.docs) {
      warnings.push('Active items should have documentation');
    }
    if (!item.tests) {
      warnings.push('Active items should have tests');
    }
    if (item.riskLevel === 'critical' && (!item.docs || !item.tests)) {
      errors.push('Active critical items must have docs and tests');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function getDashboardTabContract(item) {
  return {
    id: item.id,
    canonicalId: item.canonicalId,
    title: item.title,
    description: item.description,
    group: item.group || 'General',
    dataTab: item.id,
    href: `#${item.id}`,
    rendererId: item.rendererId || `${item.id}-renderer`,
    apiRouteId: item.apiRouteId || `${item.id}-api`,
    aliases: item.aliases,
    stable: item.status === 'active',
    publicVisible: item.visibility === 'public',
    mobileVisible: Boolean(item.mobileVisible),
    ownerOnly: item.ownerOnly,
    requiresAuth: item.requiresAuth,
    expectedContent: item.expectedContent || null,
    emptyState: item.emptyState || 'No data available',
    degradedState: item.degradedState || 'Feature not configured',
    errorState: item.errorState || 'Failed to load',
    loadingState: item.loadingState || 'Loading...',
    fallbackPolicy: item.fallbackPolicy || 'degraded',
    docs: item.docs,
    tests: item.tests,
    enabled: item.enabled
  };
}

function getDashboardApiContract(item) {
  return {
    id: item.id,
    method: item.method || 'GET',
    path: item.path || `/api/dashboard/${item.id}`,
    tabId: item.tabId || null,
    module: item.module,
    requiresAuth: item.requiresAuth,
    requiresOwner: item.requiresOwner,
    requiresAdmin: item.requiresAdmin,
    riskLevel: item.riskLevel,
    actionType: item.actionType || 'read',
    responseContract: item.responseContract || { ok: true, data: {} },
    errorContract: item.errorContract || { ok: false, error: 'ERROR' },
    cachePolicy: item.cachePolicy || 'no-cache',
    redactionPolicy: item.redactionPolicy || 'secrets',
    directRunAllowed: item.directRunAllowed,
    enabled: item.enabled
  };
}

function getTelegramCommandContract(item) {
  return {
    id: item.id,
    command: item.command || item.id,
    canonicalCommand: item.canonicalCommand || item.command || item.id,
    aliases: item.aliases,
    module: item.module,
    description: item.description,
    handlerName: item.handlerName || `handle${item.id}`,
    riskLevel: item.riskLevel,
    actionType: item.actionType || 'read',
    requiresOwner: item.requiresOwner,
    requiresAdmin: item.requiresAdmin,
    requiresApproval: item.requiresApproval,
    requiresEvaluation: item.requiresEvaluation,
    directRunAllowed: item.directRunAllowed,
    privateDataAllowed: item.privateDataAllowed || false,
    docs: item.docs,
    tests: item.tests,
    enabled: item.enabled
  };
}

function getCapabilityContract(item) {
  return {
    id: item.id,
    module: item.module,
    action: item.action || item.id,
    actionType: item.actionType || 'read',
    riskLevel: item.riskLevel,
    externalSystem: item.externalSystem || null,
    dataSensitivity: item.dataSensitivity || 'low',
    requiresApproval: item.requiresApproval,
    requiresEvaluation: item.requiresEvaluation,
    requiresSecretScan: item.requiresSecretScan || false,
    requiresCostGuard: item.requiresCostGuard || false,
    requiresPrivacyGuard: item.requiresPrivacyGuard || false,
    directRunAllowed: item.directRunAllowed,
    ownerOnly: item.ownerOnly,
    enabled: item.enabled
  };
}

module.exports = {
  createEmptyRegistryV3Item,
  createRegistryV3Item,
  validateRegistryV3ItemContract,
  getDashboardTabContract,
  getDashboardApiContract,
  getTelegramCommandContract,
  getCapabilityContract
};
