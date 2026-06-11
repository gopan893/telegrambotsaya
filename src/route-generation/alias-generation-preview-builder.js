/**
 * Alias Generation Preview Builder
 * Generates preview of aliases from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const aliasContract = require('./alias-contract-v3');
const v3utils = require('../registry-v3/registry-v3-utils');

function buildAliasGenerationPreview(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      success: false,
      error: 'No frozen registry v3 available'
    };
  }

  const aliasItems = frozen.items.filter(i => i.type === 'alias');

  const preview = {
    generatedAt: new Date().toISOString(),
    source: 'registry-v3-frozen',
    totalAliases: aliasItems.length,
    aliases: [],
    byStatus: { active: 0, deprecated: 0, blocked: 0, other: 0 },
    conflicts: [],
    warnings: []
  };

  for (const item of aliasItems) {
    const result = aliasContract.buildAliasContractV3(item, services);
    if (!result.success) {
      preview.warnings.push({ id: item.id, error: result.error });
      continue;
    }

    const c = result.contract;

    const aliasPreview = {
      alias: c.alias,
      canonicalId: c.canonicalId,
      type: c.type,
      module: c.module,
      sourceVersion: c.sourceVersion,
      status: c.status,
      conflictStatus: c.conflictStatus,
      deprecationStatus: c.deprecationStatus,
      migrationNotes: c.migrationNotes,
      enabled: c.enabled
    };

    preview.aliases.push(aliasPreview);

    const s = c.status;
    if (s === 'active') preview.byStatus.active++;
    else if (s === 'deprecated') preview.byStatus.deprecated++;
    else if (s === 'blocked') preview.byStatus.blocked++;
    else preview.byStatus.other++;
  }

  const aliasConflicts = aliasContract.detectAliasConflictsV3(services);
  preview.conflicts = aliasConflicts.conflicts || [];

  return {
    success: true,
    preview: v3utils.sanitizeForDisplay(preview)
  };
}

function validateAliasGenerationPreview(preview, services) {
  const errors = [];
  const warnings = [];

  if (!preview) {
    errors.push('Preview is null');
    return { valid: false, errors, warnings };
  }

  if (!Array.isArray(preview.aliases)) {
    errors.push('Missing aliases array');
    return { valid: false, errors, warnings };
  }

  for (const alias of preview.aliases) {
    if (!alias.alias) {
      errors.push('Alias missing alias field');
    }
    if (!alias.canonicalId) {
      errors.push('Alias missing canonicalId');
    }
    if (alias.status === 'blocked' && !alias.migrationNotes) {
      errors.push(`Blocked alias ${alias.alias} missing migration notes`);
    }
  }

  const conflicts = preview.conflicts || [];
  for (const c of conflicts) {
    if (c.severity === 'P0' || c.severity === 'P1') {
      errors.push(`Conflict P${c.severity}: ${c.type} - ${c.alias}`);
    } else {
      warnings.push(`Conflict: ${c.type} - ${c.alias}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function buildAliasGenerationPreviewReport(services) {
  const result = buildAliasGenerationPreview(services);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      generatedAt: new Date().toISOString()
    };
  }

  const validation = validateAliasGenerationPreview(result.preview, services);

  return {
    success: true,
    preview: result.preview,
    validation,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildAliasGenerationPreview,
  validateAliasGenerationPreview,
  buildAliasGenerationPreviewReport
};