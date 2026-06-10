'use strict';

/**
 * V3 Storage Boundary Plan
 * Defines storage architecture and boundaries for AI OS v3.
 *
 * STORAGE PRINCIPLES:
 * - No destructive migrations without rollback
 * - No hard deletes
 * - Secret values redacted
 * - Durable storage for critical audit/security/executor
 * - Optional storage fallback for non-critical
 * - Clear module boundaries for storage access
 */

const STORAGE_TYPES = {
  CRITICAL: 'critical',
  DURABLE: 'durable',
  EPHEMERAL: 'ephemeral',
  CACHE: 'cache'
};

const STORAGE_MODULES = [
  'audit',
  'security',
  'executor',
  'governance',
  'memory',
  'goals',
  'workflows',
  'devices',
  'backup',
  'settings'
];

/**
 * Create storage boundary v3 plan
 * @param {Object} services - Service dependencies
 * @returns {Object} - Storage boundary plan
 */
async function createStorageBoundaryV3Plan(services) {
  const plan = {
    version: 'v3.0.0',
    storageArchitecture: {
      critical: ['audit', 'security', 'executor', 'governance'],
      durable: ['memory', 'goals', 'workflows', 'devices', 'backup'],
      ephemeral: ['cache', 'sessions', 'temp'],
      optional: ['insights', 'analytics', 'recommendations']
    },
    principles: [
      'Critical storage never fails silently',
      'Durable storage persists across restarts',
      'Ephemeral storage can be cleared',
      'Optional storage degrades gracefully',
      'No hard deletes - archive instead',
      'Secret values never stored',
      'Migration rollback always available'
    ],
    boundaries: await mapStorageAccessV3(services),
    adapterContract: defineStorageAdapterContractV3(),
    migrationPolicy: defineStorageMigrationPolicyV3(),
    backupPolicy: defineBackupRecoveryPolicyV3(),
    createdAt: new Date().toISOString()
  };

  return plan;
}

/**
 * Map storage access for v3 modules
 * @param {Object} services - Service dependencies
 * @returns {Object} - Storage access map
 */
async function mapStorageAccessV3(services) {
  const accessMap = {};

  for (const module of STORAGE_MODULES) {
    accessMap[module] = {
      storageType: getCriticalityLevel(module),
      readAccess: ['owner', 'admin'],
      writeAccess: ['owner', 'admin'],
      deleteAccess: ['admin_only'],
      requiresEncryption: isSecuritySensitive(module),
      requiresBackup: isCriticalOrDurable(module),
      degradationPolicy: getDegradationPolicy(module)
    };
  }

  return accessMap;
}

/**
 * Define storage adapter contract for v3
 * @returns {Object} - Storage adapter contract
 */
function defineStorageAdapterContractV3() {
  return {
    version: 'v3.0.0',
    contract: 'StorageAdapterV3',
    requiredMethods: [
      'init()',
      'get(key)',
      'set(key, value, options)',
      'delete(key, options)',
      'list(filter, options)',
      'archive(key)',
      'backup()',
      'restore(backupId)',
      'migrate(fromVersion, toVersion)',
      'healthCheck()'
    ],
    options: {
      softDelete: true,
      encryption: 'optional',
      compression: 'optional',
      ttl: 'optional',
      backup: 'required_for_critical'
    },
    errorHandling: {
      readFallback: 'return_cached_or_degraded',
      writeFallback: 'queue_for_retry',
      deleteFallback: 'soft_delete_only',
      criticalFailure: 'alert_and_degrade'
    },
    safetyRules: [
      'No hard delete without explicit archive first',
      'No destructive migration without rollback',
      'No secret values in storage',
      'No silent failures for critical storage'
    ]
  };
}

/**
 * Define storage migration policy for v3
 * @returns {Object} - Storage migration policy
 */
function defineStorageMigrationPolicyV3() {
  return {
    version: 'v3.0.0',
    policy: 'storage-migration-v3',
    rules: [
      'All migrations must be reversible',
      'Data validation before and after migration',
      'No data loss - archive old format',
      'Migration runs in transaction where possible',
      'Failed migration triggers automatic rollback',
      'Critical storage migration requires manual approval'
    ],
    phases: [
      {
        phase: 'pre_migration',
        steps: ['validate_data', 'create_backup', 'test_migration_dry_run']
      },
      {
        phase: 'migration',
        steps: ['lock_writes', 'migrate_data', 'validate_migrated_data']
      },
      {
        phase: 'post_migration',
        steps: ['unlock_writes', 'verify_functionality', 'monitor_errors']
      },
      {
        phase: 'rollback',
        steps: ['lock_writes', 'restore_from_backup', 'verify_restoration']
      }
    ],
    safetyChecks: [
      'Backup exists before migration',
      'Migration tested in staging',
      'Rollback plan documented',
      'No concurrent writes during migration',
      'Data integrity validated'
    ]
  };
}

/**
 * Define backup and recovery policy for v3
 * @returns {Object} - Backup recovery policy
 */
function defineBackupRecoveryPolicyV3() {
  return {
    version: 'v3.0.0',
    policy: 'backup-recovery-v3',
    backupStrategy: {
      critical: {
        frequency: 'real_time',
        retention: '30_days',
        encryption: 'required',
        redundancy: 'multi_region'
      },
      durable: {
        frequency: 'hourly',
        retention: '7_days',
        encryption: 'required',
        redundancy: 'single_region'
      },
      ephemeral: {
        frequency: 'none',
        retention: 'none',
        encryption: 'not_required',
        redundancy: 'none'
      }
    },
    recoveryStrategy: {
      criticalDataLoss: {
        action: 'immediate_restore',
        approval: 'automatic',
        notification: 'alert_admin'
      },
      durableDataLoss: {
        action: 'restore_from_backup',
        approval: 'automatic',
        notification: 'notify_admin'
      },
      ephemeralDataLoss: {
        action: 'regenerate_or_skip',
        approval: 'none',
        notification: 'log_only'
      }
    },
    safetyRules: [
      'Backups never contain secret values',
      'Restore requires validation before use',
      'Failed restore does not delete backup',
      'Manual approval for production restore',
      'Backup integrity checked regularly'
    ]
  };
}

/**
 * Build storage boundary v3 report
 * @param {Object} services - Service dependencies
 * @returns {Object} - Storage boundary report
 */
async function buildStorageBoundaryV3Report(services) {
  const plan = await createStorageBoundaryV3Plan(services);

  return {
    report: 'v3-storage-boundary-plan',
    version: plan.version,
    summary: 'Storage architecture defined for v3',
    architecture: plan.storageArchitecture,
    principles: plan.principles,
    totalModules: STORAGE_MODULES.length,
    criticalModules: plan.storageArchitecture.critical.length,
    durableModules: plan.storageArchitecture.durable.length,
    migrationPolicy: 'defined',
    backupPolicy: 'defined',
    adapterContract: 'defined',
    status: 'planned',
    nextSteps: [
      'Implement storage adapter v3',
      'Test migration rollback',
      'Validate backup integrity',
      'Document storage access patterns'
    ],
    generatedAt: new Date().toISOString()
  };
}

// Helper functions
function getCriticalityLevel(module) {
  if (['audit', 'security', 'executor', 'governance'].includes(module)) {
    return STORAGE_TYPES.CRITICAL;
  }
  if (['memory', 'goals', 'workflows', 'devices', 'backup'].includes(module)) {
    return STORAGE_TYPES.DURABLE;
  }
  return STORAGE_TYPES.EPHEMERAL;
}

function isSecuritySensitive(module) {
  return ['audit', 'security', 'executor', 'governance', 'backup'].includes(module);
}

function isCriticalOrDurable(module) {
  return getCriticalityLevel(module) !== STORAGE_TYPES.EPHEMERAL;
}

function getDegradationPolicy(module) {
  const level = getCriticalityLevel(module);
  if (level === STORAGE_TYPES.CRITICAL) {
    return 'fail_loudly_and_alert';
  }
  if (level === STORAGE_TYPES.DURABLE) {
    return 'retry_and_warn';
  }
  return 'skip_gracefully';
}

module.exports = {
  createStorageBoundaryV3Plan,
  mapStorageAccessV3,
  defineStorageAdapterContractV3,
  defineStorageMigrationPolicyV3,
  defineBackupRecoveryPolicyV3,
  buildStorageBoundaryV3Report,
  STORAGE_TYPES,
  STORAGE_MODULES
};
