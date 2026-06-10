'use strict';

/**
 * V3 Migration Slice Validator
 * Validates migration slices for AI OS v3 to ensure safety.
 *
 * SAFETY RULES:
 * - No destructive migrations without rollback plan
 * - No missing tests for migration slices
 * - No breaking changes to stable dashboard tabs
 * - No breaking command alias compatibility
 * - No secret exposure
 * - No removal of compatibility bridges too early
 * - No direct dangerous execution
 */

const V3_SLICE_CATEGORIES = [
  'registry_contract_freeze',
  'dashboard_generation_plan',
  'api_contract_alignment',
  'command_registry_compat',
  'capability_governance_align',
  'storage_module_boundary',
  'plugin_rag_model_safety',
  'performance_pwa_hardening',
  'release_candidate_gate'
];

const BLOCKERS = {
  DESTRUCTIVE_MIGRATION: 'destructive_migration_without_rollback',
  NO_ROLLBACK: 'missing_rollback_strategy',
  NO_TESTS: 'missing_tests_for_slice',
  BREAKS_DASHBOARD: 'breaks_stable_dashboard_tab',
  BREAKS_COMMAND_ALIAS: 'breaks_command_alias_compat',
  EXPOSES_SECRET: 'secret_exposure_risk',
  REMOVES_COMPAT_EARLY: 'removes_compatibility_bridge_too_early',
  DIRECT_DANGEROUS: 'allows_direct_dangerous_execution',
  NO_DOCS: 'missing_documentation',
  UNCLEAR_SCOPE: 'unclear_migration_scope'
};

/**
 * Validate a migration slice
 * @param {Object} slice - Migration slice to validate
 * @param {Object} services - Service dependencies
 * @returns {Object} - Validation result with status and blockers
 */
async function validateV3MigrationSlice(slice, services) {
  const result = {
    sliceId: slice.id || slice.name,
    category: slice.category,
    status: 'pending',
    safe: false,
    blockers: [],
    warnings: [],
    recommendations: [],
    validatedAt: new Date().toISOString()
  };

  try {
    // Check if slice is destructive
    if (slice.isDestructive && !slice.rollbackPlan) {
      result.blockers.push({
        type: BLOCKERS.DESTRUCTIVE_MIGRATION,
        severity: 'P0',
        message: 'Destructive migration requires rollback plan'
      });
    }

    // Check rollback plan
    if (!slice.rollbackPlan || !slice.rollbackPlan.steps) {
      result.blockers.push({
        type: BLOCKERS.NO_ROLLBACK,
        severity: 'P1',
        message: 'Migration slice must include rollback strategy'
      });
    }

    // Check tests
    if (!slice.testFiles || slice.testFiles.length === 0) {
      result.blockers.push({
        type: BLOCKERS.NO_TESTS,
        severity: 'P0',
        message: 'Migration slice must have test coverage'
      });
    }

    // Check dashboard compatibility
    if (slice.affectsDashboard && !slice.dashboardCompatTest) {
      result.blockers.push({
        type: BLOCKERS.BREAKS_DASHBOARD,
        severity: 'P0',
        message: 'Dashboard changes must preserve stable tab functionality'
      });
    }

    // Check command alias compatibility
    if (slice.affectsCommands && !slice.commandCompatTest) {
      result.blockers.push({
        type: BLOCKERS.BREAKS_COMMAND_ALIAS,
        severity: 'P1',
        message: 'Command changes must preserve alias compatibility'
      });
    }

    // Check for secret exposure
    if (slice.touchesSecurity || slice.touchesEnv) {
      if (!slice.secretSafetyReview) {
        result.blockers.push({
          type: BLOCKERS.EXPOSES_SECRET,
          severity: 'P0',
          message: 'Security/env changes require secret safety review'
        });
      }
    }

    // Check compatibility bridge
    if (slice.removesCompatibilityBridge && !slice.postMigrationCompatCheck) {
      result.blockers.push({
        type: BLOCKERS.REMOVES_COMPAT_EARLY,
        severity: 'P1',
        message: 'Cannot remove compatibility bridge without verification'
      });
    }

    // Check for direct dangerous execution
    if (slice.allowsDirectExecution && slice.category !== 'internal_safe') {
      result.blockers.push({
        type: BLOCKERS.DIRECT_DANGEROUS,
        severity: 'P0',
        message: 'Migration cannot enable direct dangerous execution'
      });
    }

    // Check documentation
    if (!slice.documentationFile) {
      result.warnings.push({
        type: BLOCKERS.NO_DOCS,
        severity: 'P2',
        message: 'Migration slice should have documentation'
      });
    }

    // Check scope clarity
    if (!slice.scope || !slice.scope.description) {
      result.warnings.push({
        type: BLOCKERS.UNCLEAR_SCOPE,
        severity: 'P2',
        message: 'Migration scope should be clearly defined'
      });
    }

    // Determine overall status
    result.safe = result.blockers.length === 0;
    result.status = result.safe ? 'ready' : 'blocked';

    // Add recommendations
    if (result.warnings.length > 0) {
      result.recommendations.push('Address warnings to improve migration quality');
    }
    if (result.safe) {
      result.recommendations.push('Run migration in staging environment first');
      result.recommendations.push('Monitor metrics during migration');
      result.recommendations.push('Keep rollback plan ready');
    }

  } catch (error) {
    result.status = 'error';
    result.error = error.message;
    result.blockers.push({
      type: 'validation_error',
      severity: 'P0',
      message: `Validation failed: ${error.message}`
    });
  }

  return result;
}

/**
 * Detect unsafe migration slices in a migration plan
 * @param {Object} slice - Migration slice
 * @param {Object} services - Service dependencies
 * @returns {Array} - List of unsafe aspects
 */
async function detectUnsafeV3MigrationSlice(slice, services) {
  const unsafe = [];

  if (slice.isDestructive && !slice.rollbackPlan) {
    unsafe.push('Destructive without rollback');
  }

  if (slice.affectsDashboard && !slice.dashboardCompatTest) {
    unsafe.push('Dashboard changes untested');
  }

  if (slice.affectsCommands && !slice.commandCompatTest) {
    unsafe.push('Command changes untested');
  }

  if (!slice.testFiles || slice.testFiles.length === 0) {
    unsafe.push('No test coverage');
  }

  if (slice.allowsDirectExecution) {
    unsafe.push('Allows direct dangerous execution');
  }

  return unsafe;
}

/**
 * Check for missing rollback plan
 * @param {Object} slice - Migration slice
 * @param {Object} services - Service dependencies
 * @returns {Object} - Rollback check result
 */
async function detectMissingRollbackForSlice(slice, services) {
  const result = {
    sliceId: slice.id || slice.name,
    hasRollback: false,
    rollbackQuality: 'none',
    issues: []
  };

  if (!slice.rollbackPlan) {
    result.issues.push('No rollback plan defined');
    return result;
  }

  result.hasRollback = true;

  if (!slice.rollbackPlan.steps || slice.rollbackPlan.steps.length === 0) {
    result.issues.push('Rollback plan has no steps');
    result.rollbackQuality = 'incomplete';
  } else if (!slice.rollbackPlan.testStrategy) {
    result.issues.push('Rollback plan not tested');
    result.rollbackQuality = 'untested';
  } else {
    result.rollbackQuality = 'good';
  }

  return result;
}

/**
 * Check for missing tests
 * @param {Object} slice - Migration slice
 * @param {Object} services - Service dependencies
 * @returns {Object} - Test coverage check result
 */
async function detectMissingTestsForSlice(slice, services) {
  const result = {
    sliceId: slice.id || slice.name,
    hasTests: false,
    testCoverage: 'none',
    missingTests: []
  };

  if (!slice.testFiles || slice.testFiles.length === 0) {
    result.missingTests.push('No test files defined');
    return result;
  }

  result.hasTests = true;

  // Check specific test types
  if (slice.affectsDashboard && !slice.testFiles.find(t => t.includes('dashboard'))) {
    result.missingTests.push('Dashboard compatibility test');
    result.testCoverage = 'partial';
  }

  if (slice.affectsCommands && !slice.testFiles.find(t => t.includes('command'))) {
    result.missingTests.push('Command compatibility test');
    result.testCoverage = 'partial';
  }

  if (slice.affectsAPI && !slice.testFiles.find(t => t.includes('api'))) {
    result.missingTests.push('API contract test');
    result.testCoverage = 'partial';
  }

  if (result.missingTests.length === 0) {
    result.testCoverage = 'good';
  }

  return result;
}

/**
 * Build migration slice validation report
 * @param {Object} services - Service dependencies
 * @returns {Object} - Complete validation report
 */
async function buildMigrationSliceValidationReport(services) {
  return {
    report: 'v3-migration-slice-validation',
    status: 'ready',
    summary: 'Migration slice validation system ready',
    capabilities: {
      validateSlice: true,
      detectUnsafe: true,
      checkRollback: true,
      checkTests: true
    },
    guidelines: [
      'All migration slices must have rollback plans',
      'All slices must have test coverage',
      'Dashboard changes must preserve stable tabs',
      'Command changes must preserve aliases',
      'No direct dangerous execution',
      'No secret exposure',
      'Compatibility bridges preserved until verified'
    ],
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  validateV3MigrationSlice,
  detectUnsafeV3MigrationSlice,
  detectMissingRollbackForSlice,
  detectMissingTestsForSlice,
  buildMigrationSliceValidationReport,
  V3_SLICE_CATEGORIES,
  BLOCKERS
};
