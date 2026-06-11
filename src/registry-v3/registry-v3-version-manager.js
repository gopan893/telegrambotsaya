/**
 * Registry v3 Version Manager
 * Manages registry v3 contract versioning and change classification
 */

const store = require('./registry-v3-store');

function getCurrentRegistryV3Version(services) {
  const frozen = store.getFrozen();
  const metadata = store.getFreezeMetadata();

  if (!frozen) {
    return {
      hasVersion: false,
      currentVersion: null,
      status: 'no_frozen_contract'
    };
  }

  return {
    hasVersion: true,
    currentVersion: metadata?.contractVersion || frozen.version || '3.0.0',
    status: metadata?.status || 'unknown',
    frozenAt: metadata?.frozenAt,
    itemCount: frozen.items?.length || 0
  };
}

function proposeRegistryV3VersionBump(change, services) {
  const { logger } = services;
  const current = getCurrentRegistryV3Version(services);

  if (!current.hasVersion) {
    return {
      canPropose: false,
      error: 'No frozen contract exists to version'
    };
  }

  const classification = classifyRegistryV3VersionChange(change, services);

  if (!classification.valid) {
    return {
      canPropose: false,
      error: 'Invalid change classification',
      reasons: classification.errors
    };
  }

  const [major, minor, patch] = parseVersion(current.currentVersion);
  let proposedVersion;

  if (classification.changeType === 'major') {
    proposedVersion = `${major + 1}.0.0`;
  } else if (classification.changeType === 'minor') {
    proposedVersion = `${major}.${minor + 1}.0`;
  } else if (classification.changeType === 'patch') {
    proposedVersion = `${major}.${minor}.${patch + 1}`;
  } else {
    return {
      canPropose: false,
      error: `Unknown change type: ${classification.changeType}`
    };
  }

  const proposal = {
    currentVersion: current.currentVersion,
    proposedVersion,
    changeType: classification.changeType,
    changeDescription: change.description || 'No description provided',
    requiresApproval: classification.requiresApproval,
    requiresMigrationPlan: classification.requiresMigrationPlan,
    compatibilityNotes: change.compatibilityNotes || [],
    migrationNotes: change.migrationNotes || [],
    createdAt: new Date().toISOString()
  };

  if (logger) {
    logger.info('[Registry v3] Version bump proposed', {
      from: proposal.currentVersion,
      to: proposal.proposedVersion,
      type: proposal.changeType
    });
  }

  return {
    canPropose: true,
    proposal
  };
}

function classifyRegistryV3VersionChange(change, services) {
  const errors = [];
  const warnings = [];

  if (!change) {
    errors.push('Change object is required');
    return { valid: false, errors, warnings };
  }

  if (!change.type) {
    errors.push('Change type is required');
    return { valid: false, errors, warnings };
  }

  let changeType = 'patch';
  let requiresApproval = false;
  let requiresMigrationPlan = false;

  switch (change.type) {
    case 'add_field':
      changeType = 'minor';
      warnings.push('Adding field is a minor version change');
      break;

    case 'remove_field':
      changeType = 'major';
      requiresApproval = true;
      requiresMigrationPlan = true;
      warnings.push('Removing field is a major breaking change');
      break;

    case 'change_field_type':
      changeType = 'major';
      requiresApproval = true;
      requiresMigrationPlan = true;
      warnings.push('Changing field type is a major breaking change');
      break;

    case 'add_item':
      changeType = 'minor';
      if (change.itemType === 'dashboard_tab') {
        warnings.push('Adding dashboard tab requires testing');
      }
      break;

    case 'remove_item':
      changeType = 'major';
      requiresApproval = true;
      requiresMigrationPlan = true;
      warnings.push('Removing item is a major breaking change');
      break;

    case 'change_risk_behavior':
      changeType = 'major';
      requiresApproval = true;
      warnings.push('Changing risk behavior is a major change');
      break;

    case 'change_direct_run_allowed':
      if (change.from === false && change.to === true && change.dangerous) {
        changeType = 'major';
        requiresApproval = true;
        errors.push('Cannot enable directRunAllowed for dangerous actions');
      } else {
        changeType = 'minor';
        requiresApproval = true;
      }
      break;

    case 'remove_compatibility_alias':
      changeType = 'major';
      requiresMigrationPlan = true;
      warnings.push('Removing alias requires migration plan');
      break;

    case 'update_docs':
    case 'update_tests':
    case 'update_description':
      changeType = 'patch';
      break;

    case 'deprecate_item':
      changeType = 'minor';
      warnings.push('Deprecation should include migration timeline');
      break;

    default:
      warnings.push(`Unknown change type: ${change.type}, defaulting to patch`);
      changeType = 'patch';
  }

  return {
    valid: errors.length === 0,
    changeType,
    requiresApproval,
    requiresMigrationPlan,
    errors,
    warnings
  };
}

function buildRegistryV3VersionReport(services) {
  const current = getCurrentRegistryV3Version(services);
  const history = store.getVersionHistory();

  return {
    current: {
      version: current.currentVersion,
      status: current.status,
      frozenAt: current.frozenAt,
      itemCount: current.itemCount
    },
    history: history.map(h => ({
      version: h.contractVersion,
      changes: h.changes || [],
      createdAt: h.createdAt,
      recordedAt: h.recordedAt
    })),
    historyCount: history.length,
    versioningRules: {
      patch: 'Documentation, tests, descriptions only',
      minor: 'Additive changes: new fields, items, aliases',
      major: 'Breaking changes: removals, type changes, behavior changes'
    },
    approvalRequired: {
      major: true,
      minor: false,
      patch: false
    }
  };
}

function parseVersion(version) {
  if (!version || typeof version !== 'string') {
    return [3, 0, 0];
  }

  const parts = version.split('.');
  return [
    parseInt(parts[0]) || 3,
    parseInt(parts[1]) || 0,
    parseInt(parts[2]) || 0
  ];
}

function recordVersionChange(version, changes, services) {
  const { logger } = services;

  const versionRecord = {
    contractVersion: version,
    changes: Array.isArray(changes) ? changes : [changes],
    createdAt: new Date().toISOString(),
    status: 'recorded'
  };

  store.addVersionHistory(versionRecord);

  if (logger) {
    logger.info('[Registry v3] Version change recorded', {
      version,
      changeCount: versionRecord.changes.length
    });
  }

  return {
    success: true,
    record: versionRecord
  };
}

module.exports = {
  getCurrentRegistryV3Version,
  proposeRegistryV3VersionBump,
  classifyRegistryV3VersionChange,
  buildRegistryV3VersionReport,
  recordVersionChange
};
