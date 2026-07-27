'use strict';

const utils = require('./storage-boundary-utils');

const RISK_CATEGORIES = [
  { id: 'data-loss', description: 'Potential data loss during migration', severity: 'critical', mitigation: 'Ensure full backup before migration' },
  { id: 'downtime', description: 'Service downtime during migration', severity: 'high', mitigation: 'Use blue-green deployment or rolling migration' },
  { id: 'incompatible-schema', description: 'Incompatible schema between storage types', severity: 'high', mitigation: 'Run schema compatibility check before migration' },
  { id: 'connection-string-exposure', description: 'Risk of connection string exposure in logs', severity: 'medium', mitigation: 'Redact connection strings in all logs' },
  { id: 'fallback-unavailable', description: 'Fallback storage not available during switch', severity: 'medium', mitigation: 'Verify fallback is healthy before migration' },
  { id: 'rollback-failure', description: 'Rollback may fail if migration is partially applied', severity: 'critical', mitigation: 'Use transaction-based migration with rollback script' }
];

function createStorageMigrationPlan(input, services) {
  if (!input) return { error: 'no input provided' };
  const plan = {
    id: `migration-${Date.now()}`,
    from: input.from || 'unknown',
    to: input.to || 'unknown',
    module: input.module || 'unknown',
    steps: [],
    risks: [],
    estimatedImpact: input.estimatedImpact || 'medium',
    createdAt: new Date().toISOString()
  };
  plan.steps.push({ order: 1, action: 'backup', description: `Backup ${input.from} storage for ${input.module}` });
  plan.steps.push({ order: 2, action: 'validate', description: `Validate ${input.to} storage readiness` });
  plan.steps.push({ order: 3, action: 'migrate', description: `Migrate data from ${input.from} to ${input.to}` });
  plan.steps.push({ order: 4, action: 'verify', description: `Verify data integrity after migration` });
  plan.steps.push({ order: 5, action: 'switch', description: `Switch ${input.module} to use ${input.to}` });
  plan.steps.push({ order: 6, action: 'cleanup', description: `Cleanup old ${input.from} data after verification` });
  return plan;
}

function detectMigrationRisks(services) {
  return RISK_CATEGORIES;
}

function generateNonDestructiveMigrationSteps(services) {
  return [
    { order: 1, action: 'snapshot', description: 'Create read-only snapshot of current storage' },
    { order: 2, action: 'dry-run', description: 'Perform dry-run migration to validate process' },
    { order: 3, action: 'validate-snapshot', description: 'Validate snapshot integrity' },
    { order: 4, action: 'incremental-sync', description: 'Sync changes incrementally' },
    { order: 5, action: 'final-verification', description: 'Verify target matches source' },
    { order: 6, action: 'cutover', description: 'Perform read-only cutover for verification' }
  ];
}

function generateMigrationRollbackPlan(services) {
  return {
    id: `rollback-${Date.now()}`,
    steps: [
      { order: 1, action: 'halt-writes', description: 'Halt writes to new storage' },
      { order: 2, action: 'restore-backup', description: 'Restore from pre-migration backup' },
      { order: 3, action: 'verify-restore', description: 'Verify restored data integrity' },
      { order: 4, action: 'switch-back', description: 'Switch module back to original storage' },
      { order: 5, action: 'cleanup', description: 'Cleanup partial migration artifacts' }
    ],
    note: 'Rollback should be tested in staging before production migration'
  };
}

function generateMigrationTestPlan(services) {
  return {
    id: `migration-test-${Date.now()}`,
    phases: [
      { phase: 1, description: 'Unit tests for migration logic', required: true },
      { phase: 2, description: 'Integration tests with test data', required: true },
      { phase: 3, description: 'Performance benchmark before/after', required: true },
      { phase: 4, description: 'Rollback test validation', required: true },
      { phase: 5, description: 'Data integrity verification tests', required: true },
      { phase: 6, description: 'Load test during migration simulation', required: false }
    ]
  };
}

module.exports = {
  createStorageMigrationPlan,
  detectMigrationRisks,
  generateNonDestructiveMigrationSteps,
  generateMigrationRollbackPlan,
  generateMigrationTestPlan
};
