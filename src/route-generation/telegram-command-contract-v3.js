/**
 * Telegram Command Contract v3
 * Builds and validates Telegram command contracts from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const v3utils = require('../registry-v3/registry-v3-utils');

function buildTelegramCommandContractV3(item, services) {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }

  if (item.type !== 'telegram_command') {
    return { success: false, error: `Item type must be telegram_command, got ${item.type}` };
  }

  const contract = {
    id: item.id,
    command: item.command || `/${item.id}`,
    canonicalCommand: item.canonicalCommand || item.command || `/${item.id}`,
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    module: item.module || null,
    description: item.description || null,
    handlerName: item.handlerName || `handle${capitalize(item.id)}`,
    riskLevel: item.riskLevel || 'low',
    actionType: item.actionType || 'read',
    requiresOwner: Boolean(item.requiresOwner),
    requiresAdmin: Boolean(item.requiresAdmin),
    requiresApproval: item.requiresApproval !== undefined
      ? Boolean(item.requiresApproval)
      : v3utils.requiresApprovalByDefault(item),
    requiresEvaluation: Boolean(item.requiresEvaluation),
    directRunAllowed: item.directRunAllowed !== undefined
      ? Boolean(item.directRunAllowed)
      : !v3utils.isDangerousActionType(item.actionType),
    privateDataAllowed: Boolean(item.privateDataAllowed),
    docs: item.docs || null,
    tests: item.tests || null,
    enabled: item.enabled !== false
  };

  return { success: true, contract };
}

function validateTelegramCommandContractV3(contract, services) {
  const errors = [];
  const warnings = [];

  if (!contract) {
    errors.push('Contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!contract.id) {
    errors.push('Missing command id');
  }

  if (!contract.command || !contract.command.startsWith('/')) {
    errors.push('Command must start with /');
  }

  if (!contract.canonicalCommand) {
    errors.push('Missing canonicalCommand');
  }

  if (!contract.handlerName) {
    warnings.push('Missing handlerName');
  }

  if (!contract.module) {
    warnings.push('Missing module');
  }

  if (!contract.description) {
    warnings.push('Missing description');
  }

  if (!v3utils.isValidRiskLevel(contract.riskLevel)) {
    errors.push(`Invalid riskLevel: ${contract.riskLevel}`);
  }

  if (!v3utils.isValidActionType(contract.actionType)) {
    errors.push(`Invalid actionType: ${contract.actionType}`);
  }

  if (contract.riskLevel === 'critical' && contract.directRunAllowed) {
    errors.push('Critical commands cannot have directRunAllowed=true');
  }

  if (v3utils.isDangerousActionType(contract.actionType) && contract.directRunAllowed) {
    errors.push('Dangerous commands must have directRunAllowed=false');
  }

  if (contract.actionType === 'external_write' && !contract.requiresApproval) {
    errors.push('external_write commands require approval');
  }

  if (contract.command === '/shell' || contract.command.includes('shell')) {
    errors.push('Shell executor commands are blocked');
  }

  if (contract.aliases && contract.aliases.some(a => !a || typeof a !== 'string')) {
    errors.push('Invalid alias found');
  }

  if (contract.status === 'active') {
    if (!contract.docs) {
      warnings.push('Active commands should have docs');
    }
    if (!contract.tests) {
      warnings.push('Active commands should have tests');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function normalizeCommandContractFromV2(command, services) {
  if (!command) return null;

  return {
    id: command.id || v3utils.normalizeId(command.command),
    command: command.command || `/${command.id}`,
    canonicalCommand: command.canonicalCommand || command.command || `/${command.id}`,
    aliases: Array.isArray(command.aliases) ? command.aliases : [],
    module: command.module || null,
    description: command.description || null,
    handlerName: command.handlerName || `handle${capitalize(command.id)}`,
    riskLevel: command.riskLevel || 'low',
    actionType: command.actionType || 'read',
    requiresOwner: Boolean(command.requiresOwner),
    requiresAdmin: Boolean(command.requiresAdmin),
    requiresApproval: command.requiresApproval !== undefined
      ? Boolean(command.requiresApproval)
      : v3utils.requiresApprovalByDefault(command),
    requiresEvaluation: Boolean(command.requiresEvaluation),
    directRunAllowed: command.directRunAllowed !== undefined
      ? Boolean(command.directRunAllowed)
      : !v3utils.isDangerousActionType(command.actionType),
    privateDataAllowed: Boolean(command.privateDataAllowed),
    docs: command.docs || null,
    tests: command.tests || null,
    enabled: command.enabled !== false
  };
}

function detectCommandAliasConflictV3(services) {
  const frozen = store.getFrozen();
  if (!frozen || !frozen.items) {
    return { hasConflicts: false, conflicts: [] };
  }

  const commandItems = frozen.items.filter(i => i.type === 'telegram_command');
  const aliasMap = {};
  const commandMap = {};
  const conflicts = [];

  for (const item of commandItems) {
    const cmd = item.command || `/${item.id}`;
    if (commandMap[cmd]) {
      conflicts.push({
        type: 'command_dup',
        command: cmd,
        existing: commandMap[cmd],
        duplicate: item.id,
        severity: 'P1'
      });
    }
    commandMap[cmd] = item.id;

    for (const alias of (item.aliases || [])) {
      if (commandMap[alias]) {
        conflicts.push({
          type: 'alias_collides_command',
          alias,
          command: commandMap[alias],
          conflictingItem: item.id,
          severity: 'P1'
        });
      }
      if (aliasMap[alias]) {
        conflicts.push({
          type: 'alias_dup',
          alias,
          existing: aliasMap[alias],
          duplicate: item.id,
          severity: 'P2'
        });
      }
      aliasMap[alias] = item.id;
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

function buildTelegramCommandContractReport(services) {
  const frozen = store.getFrozen();
  const items = (frozen && frozen.items || []).filter(i => i.type === 'telegram_command');
  const results = [];
  let validCount = 0;
  let errorCount = 0;

  for (const item of items) {
    const contract = buildTelegramCommandContractV3(item, services);
    if (!contract.success) {
      errorCount++;
      results.push({ id: item.id, valid: false, error: contract.error });
      continue;
    }
    const validation = validateTelegramCommandContractV3(contract.contract, services);
    results.push({
      id: item.id,
      command: contract.contract.command,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    });
    if (validation.valid) validCount++;
    else errorCount++;
  }

  const aliasConflicts = detectCommandAliasConflictV3(services);

  return {
    total: items.length,
    valid: validCount,
    errors: errorCount,
    results,
    aliasConflicts,
    generatedAt: new Date().toISOString()
  };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  buildTelegramCommandContractV3,
  validateTelegramCommandContractV3,
  normalizeCommandContractFromV2,
  detectCommandAliasConflictV3,
  buildTelegramCommandContractReport
};