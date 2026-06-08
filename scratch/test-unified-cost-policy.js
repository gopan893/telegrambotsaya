'use strict';

const costPolicy = require('../src/governance/unified-cost-policy');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== test-unified-cost-policy.js ===\n');

// Test determineCostGuardRequirement - read
const readGuard = costPolicy.determineCostGuardRequirement(
  { actionType: 'read' }
);
assert(readGuard.costGuardRequired === false, 'Read action does not require cost guard');

// Test determineCostGuardRequirement - report
const reportGuard = costPolicy.determineCostGuardRequirement(
  { actionType: 'report' }
);
assert(reportGuard.costGuardRequired === false, 'Report does not require cost guard');

// Test determineCostGuardRequirement - plan
const planGuard = costPolicy.determineCostGuardRequirement(
  { actionType: 'plan' }
);
assert(planGuard.costGuardRequired === false, 'Plan does not require cost guard');

// Test determineCostGuardRequirement - high risk
const highRiskGuard = costPolicy.determineCostGuardRequirement(
  { actionType: 'external_write' }, { riskLevel: 'high' }
);
assert(highRiskGuard.costGuardRequired === true, 'High risk external write requires cost guard');

// Test determineCostGuardRequirement - external_write
const extWriteGuard = costPolicy.determineCostGuardRequirement(
  { actionType: 'external_write' }, { riskLevel: 'medium' }
);
assert(extWriteGuard.costGuardRequired === true, 'External write requires cost guard');

// Test estimateGovernanceActionCost
const readCost = costPolicy.estimateGovernanceActionCost({ actionType: 'read' });
assert(readCost.estimatedCost <= 0.01, 'Read action cost is minimal');

const dangerousCost = costPolicy.estimateGovernanceActionCost({ actionType: 'dangerous' });
assert(dangerousCost.estimatedCost > 0, 'Dangerous action has non-zero cost');
assert(dangerousCost.estimatedCost >= readCost.estimatedCost, 'Dangerous costs more than read');

const deployCost = costPolicy.estimateGovernanceActionCost({ actionType: 'external_write', module: 'deploy' });
assert(deployCost.estimatedCost > 0, 'Deploy action has cost');

// Test runGovernanceCostGuard
const cheapGuard = costPolicy.runGovernanceCostGuard({ actionType: 'read' });
assert(cheapGuard.passed === true, 'Cheap cost guard passes');
assert(cheapGuard.level === 'cheap', 'Read action is cheap');

const expensiveGuard = costPolicy.runGovernanceCostGuard({ actionType: 'dangerous' });
assert(typeof expensiveGuard.level === 'string', 'Cost guard returns level');

// Test suggestCheaperGovernanceMode
const extWriteSuggestion = costPolicy.suggestCheaperGovernanceMode({ actionType: 'external_write' });
assert(extWriteSuggestion.suggestion.includes('proposal-only'), 'Suggests proposal-only for external_write');
assert(extWriteSuggestion.alternativeActionType === 'proposal', 'Alternative is proposal');

const readSuggestion = costPolicy.suggestCheaperGovernanceMode({ actionType: 'read' });
assert(readSuggestion.suggestion.includes('dry_run'), 'Suggests dry_run for read');

// Test COST_THRESHOLDS
assert(typeof costPolicy.COST_THRESHOLDS.cheap === 'number', 'Cheap threshold exists');
assert(typeof costPolicy.COST_THRESHOLDS.critical === 'number', 'Critical threshold exists');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
