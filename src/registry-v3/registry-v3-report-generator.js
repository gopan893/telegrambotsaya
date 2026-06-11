/**
 * Registry v3 Report Generator
 * Generates comprehensive reports for registry v3
 */

const store = require('./registry-v3-store');
const validator = require('./registry-v3-validator');
const conflictDetector = require('./registry-v3-conflict-detector');
const compatibilityBridge = require('./registry-v3-compatibility-bridge');
const migrationBlockerDetector = require('./registry-v3-migration-blocker-detector');
const versionManager = require('./registry-v3-version-manager');
const freezeManager = require('./registry-v3-freeze-manager');
const utils = require('./registry-v3-utils');

async function buildRegistryV3Report(services) {
  const { logger } = services;

  const report = {
    generatedAt: new Date().toISOString(),
    registryStatus: buildRegistryStatusSection(services),
    validation: await buildValidationSection(services),
    conflicts: await buildConflictsSection(services),
    compatibility: await buildCompatibilitySection(services),
    migrationBlockers: await buildMigrationBlockersSection(services),
    versioning: buildVersioningSection(services),
    itemSummary: buildItemSummarySection(services),
    recommendations: []
  };

  report.recommendations = generateOverallRecommendations(report);

  if (logger) {
    logger.info('[Registry v3] Report generated', {
      hasBlockers: report.migrationBlockers.hasBlockers,
      errorCount: report.validation.summary.errorCount,
      conflictCount: report.conflicts.summary.total
    });
  }

  return report;
}

function buildRegistryStatusSection(services) {
  const status = store.getStatus();
  const freezeStatus = freezeManager.getRegistryV3FreezeStatus(services);

  return {
    hasDraft: status.hasDraft,
    isFrozen: status.isFrozen,
    currentVersion: status.currentVersion,
    freezeMetadata: freezeStatus.freezeMetadata,
    itemCount: freezeStatus.itemCount,
    frozenAt: freezeStatus.frozenAt,
    versionHistoryCount: status.versionHistoryCount
  };
}

async function buildValidationSection(services) {
  const frozen = store.getFrozen();

  if (!frozen) {
    return {
      valid: false,
      reason: 'No frozen registry to validate',
      summary: { totalItems: 0, errorCount: 0, warningCount: 0, infoCount: 0 },
      errors: [],
      warnings: [],
      info: []
    };
  }

  const validationReport = validator.buildRegistryV3ValidationReport(frozen, services);
  return validationReport;
}

async function buildConflictsSection(services) {
  const conflictReport = conflictDetector.buildRegistryV3ConflictReport(services);
  return conflictReport;
}

async function buildCompatibilitySection(services) {
  const compatReport = await compatibilityBridge.buildRegistryV3CompatibilityReport(services);
  return compatReport;
}

async function buildMigrationBlockersSection(services) {
  const blockerReport = migrationBlockerDetector.buildMigrationBlockerReport(services);
  return blockerReport;
}

function buildVersioningSection(services) {
  const versionReport = versionManager.buildRegistryV3VersionReport(services);
  return versionReport;
}

function buildItemSummarySection(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      total: 0,
      byType: {},
      byStatus: {},
      byVisibility: {},
      byRiskLevel: {}
    };
  }

  const summary = {
    total: frozen.items.length,
    byType: {},
    byStatus: {},
    byVisibility: {},
    byRiskLevel: {}
  };

  for (const item of frozen.items) {
    summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
    summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1;
    summary.byVisibility[item.visibility] = (summary.byVisibility[item.visibility] || 0) + 1;
    summary.byRiskLevel[item.riskLevel] = (summary.byRiskLevel[item.riskLevel] || 0) + 1;
  }

  return summary;
}

function generateOverallRecommendations(report) {
  const recommendations = [];

  if (!report.registryStatus.isFrozen) {
    recommendations.push({
      priority: 'high',
      category: 'registry',
      message: 'Registry v3 is not frozen - freeze contract before proceeding',
      action: 'freeze'
    });
  }

  if (!report.validation.valid) {
    recommendations.push({
      priority: 'critical',
      category: 'validation',
      message: `Fix ${report.validation.summary.errorCount} validation errors`,
      action: 'fix_validation'
    });
  }

  if (report.conflicts.summary.p0 > 0) {
    recommendations.push({
      priority: 'critical',
      category: 'conflicts',
      message: `Fix ${report.conflicts.summary.p0} P0 conflicts immediately`,
      action: 'fix_p0_conflicts'
    });
  }

  if (report.conflicts.summary.p1 > 0) {
    recommendations.push({
      priority: 'high',
      category: 'conflicts',
      message: `Fix ${report.conflicts.summary.p1} P1 conflicts before migration`,
      action: 'fix_p1_conflicts'
    });
  }

  if (report.migrationBlockers.summary.critical > 0) {
    recommendations.push({
      priority: 'critical',
      category: 'migration',
      message: `Resolve ${report.migrationBlockers.summary.critical} critical migration blockers`,
      action: 'fix_blockers'
    });
  }

  if (report.compatibility.compatibilityStatus === 'partial_compat') {
    recommendations.push({
      priority: 'medium',
      category: 'compatibility',
      message: 'Some v2 items not mapped to v3 - review compatibility warnings',
      action: 'review_compatibility'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'info',
      category: 'status',
      message: 'Registry v3 is ready for route generation planning',
      action: 'proceed_to_route_generation'
    });
  }

  return recommendations;
}

function buildRegistryV3FreezeReport(services) {
  const freezeStatus = freezeManager.getRegistryV3FreezeStatus(services);
  const driftStatus = freezeManager.detectRegistryContractDrift(services);

  return {
    isFrozen: freezeStatus.isFrozen,
    currentVersion: freezeStatus.currentVersion,
    itemCount: freezeStatus.itemCount,
    frozenAt: freezeStatus.frozenAt,
    hasDrift: driftStatus.hasDrift,
    drifts: driftStatus.drifts || [],
    driftSummary: {
      critical: driftStatus.criticalCount || 0,
      major: driftStatus.majorCount || 0,
      minor: driftStatus.minorCount || 0
    },
    generatedAt: new Date().toISOString()
  };
}

function buildRegistryV3SafetyReport(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      safe: false,
      reason: 'No frozen registry',
      issues: []
    };
  }

  const issues = [];

  for (const item of frozen.items) {
    if (item.riskLevel === 'critical' && item.directRunAllowed) {
      issues.push({
        severity: 'critical',
        type: 'dangerous_direct_run',
        item: item.id,
        message: `Critical risk item ${item.id} has directRunAllowed=true`
      });
    }

    if (item.actionType === 'dangerous' && item.directRunAllowed) {
      issues.push({
        severity: 'critical',
        type: 'dangerous_action',
        item: item.id,
        message: `Dangerous action ${item.id} has directRunAllowed=true`
      });
    }

    const itemStr = JSON.stringify(item);
    if (/DATABASE_URL|TOKEN|SECRET|PASSWORD/i.test(itemStr)) {
      issues.push({
        severity: 'critical',
        type: 'potential_secret',
        item: item.id,
        message: `Item ${item.id} may contain secret values`
      });
    }
  }

  return {
    safe: issues.length === 0,
    issues,
    summary: {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length
    },
    generatedAt: new Date().toISOString()
  };
}

function buildRegistryV3ReadinessReport(services) {
  const report = buildRegistryV3Report(services);

  const readiness = {
    isFrozen: report.registryStatus.isFrozen,
    isValid: report.validation.valid,
    hasNoCriticalConflicts: report.conflicts.summary.p0 === 0,
    hasNoMigrationBlockers: !report.migrationBlockers.hasBlockers ||
      (report.migrationBlockers.summary.critical === 0 &&
       report.migrationBlockers.summary.high === 0),
    compatibilityStatus: report.compatibility.compatibilityStatus
  };

  readiness.ready = readiness.isFrozen &&
    readiness.isValid &&
    readiness.hasNoCriticalConflicts &&
    readiness.hasNoMigrationBlockers;

  return {
    ready: readiness.ready,
    readiness,
    blockers: report.recommendations.filter(r =>
      r.priority === 'critical' || r.priority === 'high'
    ),
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildRegistryV3Report,
  buildRegistryV3FreezeReport,
  buildRegistryV3SafetyReport,
  buildRegistryV3ReadinessReport
};
