/**
 * Registry v3 Freeze Manager
 * Manages freezing and unfreezing of registry v3 contracts
 */

const store = require('./registry-v3-store');
const contract = require('./registry-v3-contract');
const validator = require('./registry-v3-validator');

async function createRegistryV3Draft(services) {
  try {
    const { registryV2, logger } = services;

    const draft = {
      version: '3.0.0',
      createdAt: new Date().toISOString(),
      items: [],
      metadata: {
        source: 'registry-v2',
        migratedFrom: registryV2 ? 'v2' : 'manual',
        status: 'draft'
      }
    };

    if (registryV2) {
      const v2Items = await getAllRegistryV2Items(registryV2);
      draft.items = v2Items.map(v2Item => contract.createRegistryV3Item(v2Item));
    }

    store.setDraft(draft);

    if (logger) {
      logger.info('[Registry v3] Draft created', {
        itemCount: draft.items.length,
        source: draft.metadata.source
      });
    }

    return { success: true, draft };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function freezeRegistryV3Contract(input, services) {
  try {
    const { logger } = services;

    if (store.isFrozen()) {
      return {
        success: false,
        error: 'Registry v3 is already frozen',
        canOverride: false
      };
    }

    const registryToFreeze = input || store.getDraft();

    if (!registryToFreeze) {
      return {
        success: false,
        error: 'No registry to freeze (no draft or input provided)'
      };
    }

    const validationResult = await validator.validateRegistryV3Contract(
      registryToFreeze,
      services
    );

    if (!validationResult.valid) {
      return {
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings,
        canProceed: false
      };
    }

    const unsafeChanges = detectUnsafeChanges(registryToFreeze);
    if (unsafeChanges.length > 0) {
      return {
        success: false,
        error: 'Unsafe changes detected',
        unsafeChanges,
        canProceed: false
      };
    }

    const freezeMetadata = {
      frozenAt: new Date().toISOString(),
      frozenBy: 'system',
      contractVersion: registryToFreeze.version || '3.0.0',
      status: 'frozen',
      itemCount: registryToFreeze.items?.length || 0,
      validationWarnings: validationResult.warnings
    };

    store.setFrozen(registryToFreeze, freezeMetadata);

    if (logger) {
      logger.info('[Registry v3] Contract frozen', {
        version: freezeMetadata.contractVersion,
        itemCount: freezeMetadata.itemCount,
        warnings: freezeMetadata.validationWarnings?.length || 0
      });
    }

    return {
      success: true,
      frozen: registryToFreeze,
      metadata: freezeMetadata,
      warnings: validationResult.warnings
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getRegistryV3FreezeStatus(services) {
  const status = store.getStatus();
  const frozen = store.getFrozen();
  const metadata = store.getFreezeMetadata();

  return {
    isFrozen: status.isFrozen,
    hasDraft: status.hasDraft,
    currentVersion: status.currentVersion,
    freezeMetadata: metadata,
    itemCount: frozen?.items?.length || 0,
    frozenAt: metadata?.frozenAt || null,
    versionHistoryCount: status.versionHistoryCount
  };
}

async function detectRegistryContractDrift(services) {
  try {
    const frozen = store.getFrozen();
    const draft = store.getDraft();

    if (!frozen) {
      return {
        hasDrift: false,
        reason: 'No frozen contract to compare against'
      };
    }

    if (!draft) {
      return {
        hasDrift: false,
        reason: 'No draft to compare'
      };
    }

    const drifts = [];

    const frozenIds = new Set(frozen.items.map(i => i.id));
    const draftIds = new Set(draft.items.map(i => i.id));

    const addedIds = [...draftIds].filter(id => !frozenIds.has(id));
    const removedIds = [...frozenIds].filter(id => !draftIds.has(id));

    if (addedIds.length > 0) {
      drifts.push({
        type: 'items_added',
        severity: 'minor',
        count: addedIds.length,
        ids: addedIds
      });
    }

    if (removedIds.length > 0) {
      drifts.push({
        type: 'items_removed',
        severity: 'major',
        count: removedIds.length,
        ids: removedIds
      });
    }

    const commonIds = [...draftIds].filter(id => frozenIds.has(id));
    for (const id of commonIds) {
      const frozenItem = frozen.items.find(i => i.id === id);
      const draftItem = draft.items.find(i => i.id === id);

      if (frozenItem.riskLevel !== draftItem.riskLevel) {
        drifts.push({
          type: 'risk_level_changed',
          severity: 'major',
          id,
          from: frozenItem.riskLevel,
          to: draftItem.riskLevel
        });
      }

      if (frozenItem.directRunAllowed !== draftItem.directRunAllowed) {
        drifts.push({
          type: 'direct_run_changed',
          severity: 'critical',
          id,
          from: frozenItem.directRunAllowed,
          to: draftItem.directRunAllowed
        });
      }

      if (frozenItem.requiresApproval !== draftItem.requiresApproval) {
        drifts.push({
          type: 'approval_requirement_changed',
          severity: 'major',
          id,
          from: frozenItem.requiresApproval,
          to: draftItem.requiresApproval
        });
      }
    }

    return {
      hasDrift: drifts.length > 0,
      drifts,
      criticalCount: drifts.filter(d => d.severity === 'critical').length,
      majorCount: drifts.filter(d => d.severity === 'major').length,
      minorCount: drifts.filter(d => d.severity === 'minor').length
    };
  } catch (error) {
    return { hasDrift: false, error: error.message };
  }
}

function rejectUnsafeRegistryContractChange(change, services) {
  const { logger } = services;

  const rejectionReasons = [];

  if (change.type === 'enable_dangerous_direct_run') {
    rejectionReasons.push({
      reason: 'Cannot enable directRunAllowed for dangerous actions',
      severity: 'critical',
      blocked: true
    });
  }

  if (change.type === 'remove_compatibility_alias') {
    rejectionReasons.push({
      reason: 'Cannot remove compatibility alias without migration plan',
      severity: 'major',
      blocked: true
    });
  }

  if (change.type === 'change_contract_shape') {
    rejectionReasons.push({
      reason: 'Contract shape changes require version bump',
      severity: 'major',
      blocked: true
    });
  }

  if (change.type === 'remove_active_item') {
    rejectionReasons.push({
      reason: 'Cannot remove active items without deprecation period',
      severity: 'major',
      blocked: true
    });
  }

  const isBlocked = rejectionReasons.some(r => r.blocked);

  if (isBlocked && logger) {
    logger.warn('[Registry v3] Unsafe change rejected', {
      change: change.type,
      reasons: rejectionReasons
    });
  }

  return {
    rejected: isBlocked,
    reasons: rejectionReasons,
    canProceedWithApproval: !rejectionReasons.some(r => r.severity === 'critical')
  };
}

function detectUnsafeChanges(registry) {
  const unsafe = [];

  if (!registry?.items) return unsafe;

  for (const item of registry.items) {
    if (item.riskLevel === 'critical' && item.directRunAllowed) {
      unsafe.push({
        type: 'dangerous_direct_run',
        id: item.id,
        reason: 'Critical risk item has directRunAllowed=true'
      });
    }

    if (item.actionType === 'dangerous' && item.directRunAllowed) {
      unsafe.push({
        type: 'dangerous_action_direct_run',
        id: item.id,
        reason: 'Dangerous action has directRunAllowed=true'
      });
    }
  }

  return unsafe;
}

async function getAllRegistryV2Items(registryV2) {
  const items = [];

  if (registryV2.getDashboardTabs) {
    const tabs = await registryV2.getDashboardTabs();
    items.push(...tabs.map(t => ({ ...t, type: 'dashboard_tab' })));
  }

  if (registryV2.getCapabilities) {
    const caps = await registryV2.getCapabilities();
    items.push(...caps.map(c => ({ ...c, type: 'capability' })));
  }

  return items;
}

module.exports = {
  createRegistryV3Draft,
  freezeRegistryV3Contract,
  getRegistryV3FreezeStatus,
  detectRegistryContractDrift,
  rejectUnsafeRegistryContractChange
};
