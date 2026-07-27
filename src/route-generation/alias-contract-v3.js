/**
 * Alias Contract v3
 * Builds and validates alias contracts from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const v3utils = require('../registry-v3/registry-v3-utils');

function buildAliasContractV3(item, services) {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }

  if (item.type !== 'alias') {
    return { success: false, error: `Item type must be alias, got ${item.type}` };
  }

  const contract = {
    alias: item.alias || item.id,
    canonicalId: item.canonicalId || null,
    type: item.aliasType || item.referencedType || 'module',
    module: item.module || null,
    sourceVersion: item.sourceVersion || 'v2',
    status: item.status || 'active',
    conflictStatus: item.conflictStatus || 'none',
    deprecationStatus: item.deprecationStatus || 'none',
    migrationNotes: item.migrationNotes || null,
    enabled: item.enabled !== false
  };

  return { success: true, contract };
}

function validateAliasContractV3(contract, services) {
  const errors = [];
  const warnings = [];

  if (!contract) {
    errors.push('Contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!contract.alias) {
    errors.push('Missing alias');
  }

  if (!contract.canonicalId) {
    errors.push('Missing canonicalId');
  }

  if (!contract.type) {
    warnings.push('Missing type');
  }

  if (!v3utils.isValidStatus(contract.status)) {
    errors.push(`Invalid status: ${contract.status}`);
  }

  const validDeprecationStatuses = ['none', 'warned', 'deprecated', 'blocked'];
  if (!validDeprecationStatuses.includes(contract.deprecationStatus)) {
    errors.push(`Invalid deprecationStatus: ${contract.deprecationStatus}`);
  }

  const validConflictStatuses = ['none', 'potential', 'resolved', 'active'];
  if (!validConflictStatuses.includes(contract.conflictStatus)) {
    errors.push(`Invalid conflictStatus: ${contract.conflictStatus}`);
  }

  if (contract.status === 'deprecated' && contract.deprecationStatus === 'none') {
    warnings.push('Deprecated alias should have deprecation warnings');
  }

  if (contract.status === 'deprecated' && !contract.migrationNotes) {
    warnings.push('Deprecated alias should include migration notes');
  }

  if (contract.conflictStatus === 'active' && !contract.migrationNotes) {
    errors.push('Active alias conflict must have migration notes');
  }

  if (contract.status === 'blocked' && !contract.migrationNotes) {
    errors.push('Blocked alias must have migration notes explaining why');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function normalizeAliasContractFromV2(alias, services) {
  if (!alias) return null;

  return {
    alias: alias.alias || alias.name || alias.id,
    canonicalId: alias.canonicalId || null,
    type: alias.type || alias.referencedType || 'module',
    module: alias.module || null,
    sourceVersion: alias.sourceVersion || 'v2',
    status: alias.status || 'active',
    conflictStatus: alias.conflictStatus || 'none',
    deprecationStatus: alias.deprecationStatus || 'none',
    migrationNotes: alias.migrationNotes || null,
    enabled: alias.enabled !== false
  };
}

function detectAliasConflictsV3(services) {
  const frozen = store.getFrozen();
  if (!frozen || !frozen.items) {
    return { hasConflicts: false, conflicts: [] };
  }

  const aliasItems = frozen.items.filter(i => i.type === 'alias');
  const allItems = frozen.items;
  const aliasMap = {};
  const idMap = {};
  const conflicts = [];

  for (const item of allItems) {
    if (!idMap[item.id]) {
      idMap[item.id] = item;
    } else {
      conflicts.push({
        type: 'duplicate_id',
        id: item.id,
        severity: 'P1'
      });
    }

    for (const alias of (item.aliases || [])) {
      if (aliasMap[alias]) {
        conflicts.push({
          type: 'alias_collision',
          alias,
          existing: aliasMap[alias],
          conflicting: item.id,
          severity: 'P1'
        });
      }
      aliasMap[alias] = item.id;
    }
  }

  for (const aliasItem of aliasItems) {
    const a = aliasItem.alias || aliasItem.id;
    if (idMap[a] && idMap[a].id !== aliasItem.id) {
      conflicts.push({
        type: 'alias_matches_existing_id',
        alias: a,
        existingId: idMap[a].id,
        aliasId: aliasItem.id,
        severity: 'P1'
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

function buildAliasContractReport(services) {
  const frozen = store.getFrozen();
  const items = (frozen && frozen.items || []).filter(i => i.type === 'alias');
  const results = [];
  let validCount = 0;
  let errorCount = 0;

  const byStatus = { active: 0, deprecated: 0, blocked: 0, other: 0 };
  const byDeprecationStatus = { none: 0, warned: 0, deprecated: 0, blocked: 0 };

  for (const item of items) {
    const contract = buildAliasContractV3(item, services);
    if (!contract.success) {
      errorCount++;
      results.push({ id: item.id, valid: false, error: contract.error });
      continue;
    }
    const validation = validateAliasContractV3(contract.contract, services);
    results.push({
      id: item.id,
      alias: contract.contract.alias,
      canonicalId: contract.contract.canonicalId,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    });
    if (validation.valid) validCount++;
    else errorCount++;

    const s = contract.contract.status;
    if (s === 'active') byStatus.active++;
    else if (s === 'deprecated') byStatus.deprecated++;
    else if (s === 'blocked') byStatus.blocked++;
    else byStatus.other++;

    const ds = contract.contract.deprecationStatus || 'none';
    if (byDeprecationStatus[ds] !== undefined) byDeprecationStatus[ds]++;
  }

  const aliasConflicts = detectAliasConflictsV3(services);

  return {
    total: items.length,
    valid: validCount,
    errors: errorCount,
    results,
    byStatus,
    byDeprecationStatus,
    aliasConflicts,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildAliasContractV3,
  validateAliasContractV3,
  normalizeAliasContractFromV2,
  detectAliasConflictsV3,
  buildAliasContractReport
};