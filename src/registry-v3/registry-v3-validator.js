/**
 * Registry v3 Validator
 * Validates registry v3 contracts for correctness and safety
 */

const contract = require('./registry-v3-contract');
const utils = require('./registry-v3-utils');

async function validateRegistryV3Contract(registry, services) {
  const { logger } = services;
  const errors = [];
  const warnings = [];
  const info = [];

  if (!registry) {
    errors.push('Registry is null or undefined');
    return { valid: false, errors, warnings, info };
  }

  if (!registry.items || !Array.isArray(registry.items)) {
    errors.push('Registry must have items array');
    return { valid: false, errors, warnings, info };
  }

  const idValidation = validateRegistryV3Ids(registry, services);
  errors.push(...idValidation.errors);
  warnings.push(...idValidation.warnings);

  const aliasValidation = validateRegistryV3Aliases(registry, services);
  errors.push(...aliasValidation.errors);
  warnings.push(...aliasValidation.warnings);

  const dashboardValidation = validateRegistryV3DashboardItems(registry, services);
  errors.push(...dashboardValidation.errors);
  warnings.push(...dashboardValidation.warnings);

  const apiValidation = validateRegistryV3ApiItems(registry, services);
  errors.push(...apiValidation.errors);
  warnings.push(...apiValidation.warnings);

  const commandValidation = validateRegistryV3CommandItems(registry, services);
  errors.push(...commandValidation.errors);
  warnings.push(...commandValidation.warnings);

  const capabilityValidation = validateRegistryV3CapabilityItems(registry, services);
  errors.push(...capabilityValidation.errors);
  warnings.push(...capabilityValidation.warnings);

  const securityValidation = validateRegistryV3SecurityPrivacy(registry, services);
  errors.push(...securityValidation.errors);
  warnings.push(...securityValidation.warnings);

  info.push(`Total items: ${registry.items.length}`);
  info.push(`Validation checks: 7 categories`);

  if (logger && errors.length > 0) {
    logger.warn('[Registry v3] Validation failed', {
      errorCount: errors.length,
      warningCount: warnings.length
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info
  };
}

function validateRegistryV3Ids(registry, services) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const seenCanonicalIds = new Set();

  for (const item of registry.items) {
    if (!item.id) {
      errors.push(`Item missing id: ${JSON.stringify(item).substring(0, 100)}`);
      continue;
    }

    if (!utils.isValidId(item.id)) {
      errors.push(`Invalid id format: ${item.id}`);
    }

    if (seenIds.has(item.id)) {
      errors.push(`Duplicate id: ${item.id}`);
    }
    seenIds.add(item.id);

    if (item.canonicalId) {
      if (seenCanonicalIds.has(item.canonicalId)) {
        errors.push(`Duplicate canonicalId: ${item.canonicalId}`);
      }
      seenCanonicalIds.add(item.canonicalId);
    } else {
      warnings.push(`Item ${item.id} missing canonicalId`);
    }
  }

  return { errors, warnings };
}

function validateRegistryV3Aliases(registry, services) {
  const errors = [];
  const warnings = [];
  const aliasMap = new Map();

  for (const item of registry.items) {
    if (!item.aliases || item.aliases.length === 0) {
      continue;
    }

    for (const alias of item.aliases) {
      if (aliasMap.has(alias)) {
        errors.push(`Alias conflict: "${alias}" used by ${aliasMap.get(alias)} and ${item.id}`);
      } else {
        aliasMap.set(alias, item.id);
      }
    }
  }

  return { errors, warnings };
}

function validateRegistryV3DashboardItems(registry, services) {
  const errors = [];
  const warnings = [];

  const dashboardItems = registry.items.filter(i => i.type === 'dashboard_tab');

  for (const item of dashboardItems) {
    const tabContract = contract.getDashboardTabContract(item);

    if (tabContract.dataTab !== item.id) {
      errors.push(`Dashboard tab ${item.id}: dataTab mismatch`);
    }

    if (tabContract.href !== `#${item.id}`) {
      errors.push(`Dashboard tab ${item.id}: href should be #${item.id}`);
    }

    if (item.status === 'active' && !tabContract.expectedContent) {
      warnings.push(`Active dashboard tab ${item.id} missing expectedContent`);
    }

    if (tabContract.fallbackPolicy === 'overview') {
      errors.push(`Dashboard tab ${item.id}: cannot fallback to Overview`);
    }

    if (!item.rendererId && !item.apiRouteId) {
      warnings.push(`Dashboard tab ${item.id} missing renderer and API route`);
    }
  }

  return { errors, warnings };
}

function validateRegistryV3ApiItems(registry, services) {
  const errors = [];
  const warnings = [];

  const apiItems = registry.items.filter(i => i.type === 'dashboard_api');

  for (const item of apiItems) {
    const apiContract = contract.getDashboardApiContract(item);

    if (!apiContract.path.startsWith('/api/dashboard/')) {
      errors.push(`API ${item.id}: path must start with /api/dashboard/`);
    }

    if (apiContract.visibility === 'public' && apiContract.requiresAuth) {
      warnings.push(`API ${item.id}: public API should not require auth`);
    }

    if (apiContract.actionType === 'dangerous' && apiContract.directRunAllowed) {
      errors.push(`API ${item.id}: dangerous API cannot have directRunAllowed=true`);
    }

    if (apiContract.cachePolicy !== 'no-cache') {
      warnings.push(`API ${item.id}: dashboard APIs should use no-cache policy`);
    }

    if (!apiContract.responseContract) {
      warnings.push(`API ${item.id}: missing response contract`);
    }

    if (!apiContract.errorContract) {
      warnings.push(`API ${item.id}: missing error contract`);
    }
  }

  return { errors, warnings };
}

function validateRegistryV3CommandItems(registry, services) {
  const errors = [];
  const warnings = [];

  const commandItems = registry.items.filter(i => i.type === 'telegram_command');

  const seenCommands = new Set();

  for (const item of commandItems) {
    const cmdContract = contract.getTelegramCommandContract(item);

    if (seenCommands.has(cmdContract.command)) {
      errors.push(`Command conflict: ${cmdContract.command} defined multiple times`);
    }
    seenCommands.add(cmdContract.command);

    if (cmdContract.actionType === 'dangerous' && cmdContract.directRunAllowed) {
      errors.push(`Command ${item.id}: dangerous command cannot have directRunAllowed=true`);
    }

    if (item.status === 'active' && !item.docs) {
      warnings.push(`Active command ${item.id} missing documentation`);
    }
  }

  return { errors, warnings };
}

function validateRegistryV3CapabilityItems(registry, services) {
  const errors = [];
  const warnings = [];

  const capabilityItems = registry.items.filter(i => i.type === 'capability');

  for (const item of capabilityItems) {
    const capContract = contract.getCapabilityContract(item);

    if (capContract.actionType === 'dangerous' && capContract.directRunAllowed) {
      errors.push(`Capability ${item.id}: dangerous capability cannot have directRunAllowed=true`);
    }

    if (capContract.actionType === 'external_write' && capContract.directRunAllowed) {
      errors.push(`Capability ${item.id}: external_write cannot have directRunAllowed=true`);
    }

    if (capContract.action.includes('shell') || capContract.action.includes('exec')) {
      errors.push(`Capability ${item.id}: shell/exec capabilities are blocked`);
    }

    if (capContract.action.includes('approve') && capContract.action.includes('auto')) {
      errors.push(`Capability ${item.id}: auto-approve capabilities are blocked`);
    }

    if (capContract.externalSystem && !capContract.requiresApproval) {
      warnings.push(`Capability ${item.id}: external system access should require approval`);
    }
  }

  return { errors, warnings };
}

function validateRegistryV3SecurityPrivacy(registry, services) {
  const errors = [];
  const warnings = [];

  for (const item of registry.items) {
    const itemStr = JSON.stringify(item);

    const secretPatterns = [
      /DATABASE_URL\s*[:=]/i,
      /TELEGRAM_TOKEN\s*[:=]/i,
      /GITHUB_TOKEN\s*[:=]/i,
      /API_KEY\s*[:=]/i,
      /SECRET\s*[:=].*[^[\]]/i,
      /password\s*[:=].*[^[\]]/i
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(itemStr)) {
        errors.push(`Item ${item.id} contains secret-like value`);
        break;
      }
    }

    if (item.ownerOnly && item.visibility === 'public') {
      errors.push(`Item ${item.id}: ownerOnly items cannot be public`);
    }

    if (item.privateDataAllowed && !item.requiresPrivacyGuard) {
      warnings.push(`Item ${item.id}: private data access should require privacy guard`);
    }
  }

  return { errors, warnings };
}

function buildRegistryV3ValidationReport(registry, services) {
  const validation = validateRegistryV3Contract(registry, services);

  return {
    valid: validation.valid,
    summary: {
      totalItems: registry?.items?.length || 0,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      infoCount: validation.info.length
    },
    errors: validation.errors,
    warnings: validation.warnings,
    info: validation.info,
    recommendations: generateRecommendations(validation),
    generatedAt: new Date().toISOString()
  };
}

function generateRecommendations(validation) {
  const recommendations = [];

  if (validation.errors.length > 0) {
    recommendations.push('Fix all errors before freezing contract');
  }

  if (validation.warnings.length > 5) {
    recommendations.push('Consider addressing warnings to improve contract quality');
  }

  if (validation.errors.some(e => e.includes('secret'))) {
    recommendations.push('CRITICAL: Remove secret values from registry immediately');
  }

  if (validation.errors.some(e => e.includes('dangerous') && e.includes('directRunAllowed'))) {
    recommendations.push('CRITICAL: Disable directRunAllowed for dangerous actions');
  }

  return recommendations;
}

module.exports = {
  validateRegistryV3Contract,
  validateRegistryV3Ids,
  validateRegistryV3Aliases,
  validateRegistryV3DashboardItems,
  validateRegistryV3ApiItems,
  validateRegistryV3CommandItems,
  validateRegistryV3CapabilityItems,
  validateRegistryV3SecurityPrivacy,
  buildRegistryV3ValidationReport
};
