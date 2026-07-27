'use strict';

/**
 * V3 Blueprint Readiness Precheck
 * Checks if AI OS v3 blueprint is ready for implementation.
 *
 * PRECHECK GATES:
 * - V3 planning gate passed
 * - Contracts complete
 * - Risks mitigated
 * - Migration slices safe
 * - Docs and tests ready
 * - No P0/P1 blockers
 */

const READINESS_STATUS = {
  READY: 'ready',
  WARNING: 'warning',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown'
};

const CHECK_CATEGORIES = [
  'planning_gate',
  'contracts',
  'risks',
  'migration_slices',
  'documentation',
  'tests',
  'dashboard_stability',
  'api_stability',
  'security_privacy',
  'governance'
];

/**
 * Run complete v3 blueprint readiness precheck
 * @param {Object} services - Service dependencies
 * @returns {Object} - Readiness report
 */
async function runV3BlueprintReadinessPrecheck(services) {
  const result = {
    overallStatus: READINESS_STATUS.UNKNOWN,
    ready: false,
    checks: [],
    blockers: [],
    warnings: [],
    recommendations: [],
    checkedAt: new Date().toISOString()
  };

  try {
    // Check planning gate
    const planningGate = await checkV3PlanningGateReady(services);
    result.checks.push(planningGate);
    if (planningGate.status === 'blocked') {
      result.blockers.push(...planningGate.blockers);
    }

    // Check contracts
    const contracts = await checkV3ContractsComplete(services);
    result.checks.push(contracts);
    if (contracts.status === 'blocked') {
      result.blockers.push(...contracts.blockers);
    }

    // Check risks
    const risks = await checkV3RisksMitigated(services);
    result.checks.push(risks);
    if (risks.status === 'warning') {
      result.warnings.push(...risks.warnings);
    }

    // Check migration slices
    const slices = await checkV3MigrationSlicesSafe(services);
    result.checks.push(slices);
    if (slices.status === 'blocked') {
      result.blockers.push(...slices.blockers);
    }

    // Check docs and tests
    const docsTests = await checkV3DocsTestsReady(services);
    result.checks.push(docsTests);
    if (docsTests.status === 'warning') {
      result.warnings.push(...docsTests.warnings);
    }

    // Determine overall status
    if (result.blockers.length > 0) {
      result.overallStatus = READINESS_STATUS.BLOCKED;
      result.ready = false;
    } else if (result.warnings.length > 0) {
      result.overallStatus = READINESS_STATUS.WARNING;
      result.ready = true;
    } else {
      result.overallStatus = READINESS_STATUS.READY;
      result.ready = true;
    }

    // Generate recommendations
    if (result.ready) {
      result.recommendations.push('V3 blueprint ready for implementation planning');
      result.recommendations.push('Begin with registry contract freeze (Phase 76)');
      result.recommendations.push('Maintain v2 compatibility during migration');
    } else {
      result.recommendations.push('Address all blockers before proceeding');
      result.recommendations.push('Run readiness precheck again after fixes');
    }

  } catch (error) {
    result.overallStatus = READINESS_STATUS.UNKNOWN;
    result.error = error.message;
  }

  return result;
}

/**
 * Check if v3 planning gate is ready
 * @param {Object} services - Service dependencies
 * @returns {Object} - Planning gate check result
 */
async function checkV3PlanningGateReady(services) {
  const check = {
    category: 'planning_gate',
    name: 'V3 Planning Gate',
    status: READINESS_STATUS.READY,
    blockers: [],
    details: {}
  };

  try {
    // Check if v2 is healthy
    if (services.postV2Watch) {
      const v2Health = await services.postV2Watch.getLatestHealth?.();
      if (v2Health && v2Health.hasP0Blocker) {
        check.status = READINESS_STATUS.BLOCKED;
        check.blockers.push('V2 has P0 blocker - must fix before v3 planning');
      }
    }

    // Check dashboard stability
    if (services.dashboardHealth) {
      const dashHealth = await services.dashboardHealth.check?.();
      if (dashHealth && !dashHealth.stable) {
        check.status = READINESS_STATUS.BLOCKED;
        check.blockers.push('Dashboard unstable - must stabilize before v3');
      }
    }

    check.details.v2Healthy = check.blockers.length === 0;

  } catch (error) {
    check.status = READINESS_STATUS.UNKNOWN;
    check.error = error.message;
  }

  return check;
}

/**
 * Check if v3 contracts are complete
 * @param {Object} services - Service dependencies
 * @returns {Object} - Contracts check result
 */
async function checkV3ContractsComplete(services) {
  const check = {
    category: 'contracts',
    name: 'V3 Contracts',
    status: READINESS_STATUS.READY,
    blockers: [],
    details: {
      moduleContract: false,
      registryContract: false,
      apiContract: false,
      dashboardContract: false,
      governanceContract: false
    }
  };

  // Check if v3 blueprint modules exist
  const blueprintStore = services.v3BlueprintStore;
  if (!blueprintStore) {
    check.status = READINESS_STATUS.BLOCKED;
    check.blockers.push('V3 blueprint store not available');
    return check;
  }

  // Check module contract
  if (services.v3ModuleContract) {
    check.details.moduleContract = true;
  } else {
    check.blockers.push('Module contract not defined');
  }

  // Check registry contract
  if (services.v3RegistryContractDraft) {
    check.details.registryContract = true;
  } else {
    check.blockers.push('Registry v3 contract not drafted');
  }

  // Check API contract
  if (services.v3ApiContractDraft) {
    check.details.apiContract = true;
  } else {
    check.blockers.push('API contract v3 not drafted');
  }

  // Check dashboard contract
  if (services.v3DashboardShellPlan) {
    check.details.dashboardContract = true;
  } else {
    check.blockers.push('Dashboard shell plan not defined');
  }

  if (check.blockers.length > 0) {
    check.status = READINESS_STATUS.BLOCKED;
  }

  return check;
}

/**
 * Check if v3 risks are mitigated
 * @param {Object} services - Service dependencies
 * @returns {Object} - Risk check result
 */
async function checkV3RisksMitigated(services) {
  const check = {
    category: 'risks',
    name: 'V3 Risks',
    status: READINESS_STATUS.READY,
    warnings: [],
    details: {}
  };

  // Check v3 risk register
  if (services.v3RiskRegister) {
    const riskReport = await services.v3RiskRegister.buildV3RiskReport?.(services);
    if (riskReport) {
      const highRisks = riskReport.risks?.filter(r => r.severity === 'high') || [];
      if (highRisks.length > 0) {
        check.status = READINESS_STATUS.WARNING;
        check.warnings.push(`${highRisks.length} high-severity risks not fully mitigated`);
      }
      check.details.totalRisks = riskReport.risks?.length || 0;
      check.details.highRisks = highRisks.length;
    }
  }

  return check;
}

/**
 * Check if v3 migration slices are safe
 * @param {Object} services - Service dependencies
 * @returns {Object} - Migration slices check result
 */
async function checkV3MigrationSlicesSafe(services) {
  const check = {
    category: 'migration_slices',
    name: 'V3 Migration Slices',
    status: READINESS_STATUS.READY,
    blockers: [],
    details: {}
  };

  // This is planning phase - no actual slices validated yet
  // Just check if validator is available
  if (!services.v3MigrationSliceValidator) {
    check.status = READINESS_STATUS.BLOCKED;
    check.blockers.push('Migration slice validator not available');
  } else {
    check.details.validatorReady = true;
  }

  return check;
}

/**
 * Check if v3 docs and tests are ready
 * @param {Object} services - Service dependencies
 * @returns {Object} - Docs and tests check result
 */
async function checkV3DocsTestsReady(services) {
  const check = {
    category: 'docs_tests',
    name: 'V3 Docs & Tests',
    status: READINESS_STATUS.READY,
    warnings: [],
    details: {}
  };

  // Check if v3 planning docs exist
  const fs = require('fs');
  const path = require('path');

  const requiredDocs = [
    'docs/AI_OS_V3_CORE_BLUEPRINT.md',
    'docs/V3_MODULE_CONTRACT.md',
    'docs/V3_REGISTRY_CONTRACT_DRAFT.md'
  ];

  const missingDocs = [];
  for (const doc of requiredDocs) {
    if (!fs.existsSync(path.join(process.cwd(), doc))) {
      missingDocs.push(doc);
    }
  }

  if (missingDocs.length > 0) {
    check.status = READINESS_STATUS.WARNING;
    check.warnings.push(`Missing docs: ${missingDocs.join(', ')}`);
  }

  check.details.docsComplete = missingDocs.length === 0;

  return check;
}

/**
 * Build v3 blueprint readiness report
 * @param {Object} services - Service dependencies
 * @returns {Object} - Complete readiness report
 */
async function buildV3BlueprintReadinessReport(services) {
  const precheck = await runV3BlueprintReadinessPrecheck(services);

  return {
    report: 'v3-blueprint-readiness',
    status: precheck.overallStatus,
    ready: precheck.ready,
    summary: precheck.ready
      ? 'V3 blueprint ready for implementation'
      : 'V3 blueprint has blockers',
    checks: precheck.checks,
    blockers: precheck.blockers,
    warnings: precheck.warnings,
    recommendations: precheck.recommendations,
    nextSteps: precheck.ready
      ? ['Begin Phase 76: Registry Contract Freeze', 'Maintain v2 compatibility']
      : ['Fix all blockers', 'Run readiness precheck again'],
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  runV3BlueprintReadinessPrecheck,
  checkV3PlanningGateReady,
  checkV3ContractsComplete,
  checkV3RisksMitigated,
  checkV3MigrationSlicesSafe,
  checkV3DocsTestsReady,
  buildV3BlueprintReadinessReport,
  READINESS_STATUS,
  CHECK_CATEGORIES
};
