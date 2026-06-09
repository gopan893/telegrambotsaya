'use strict';

const store = require('./dr-store');
const utils = require('./dr-utils');

function createBackupEncryptionPlan(scope, services) {
  const envNames = ['BACKUP_ENCRYPTION_KEY'];

  const plan = store.createPlan(`encryption_${scope || 'default'}`, {
    name: 'Backup Encryption Plan',
    status: 'planned',
    envNames,
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Verify BACKUP_ENCRYPTION_KEY environment variable is configured (name only)',
      'Set encryptionRequired: true in backup encryption policy',
      'Configure algorithm to aes-256-gcm',
      'Encrypt existing unencrypted backups in-place',
      'Verify encrypted backup integrity'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      envNamesRequired: envNames,
      manualKeyCreationInstructions: [
        'Generate a 256-bit key: openssl rand -hex 32',
        'Store the key in a secure vault (e.g., 1Password, AWS Secrets Manager)',
        'Set BACKUP_ENCRYPTION_KEY env variable on Render dashboard',
        'Do NOT commit the key to the repository'
      ],
      storageRecommendations: [
        'Store encrypted backups in PostgreSQL or secure cloud storage',
        'Keep encryption key separate from backup storage',
        'Use a dedicated secrets manager for key storage'
      ],
      verificationSteps: [
        'Run backup-encryption-policy check to confirm encryption is active',
        'Test restore from encrypted backup in rehearsal mode',
        'Verify backup integrity after encryption'
      ],
      restoreCompatibilityNotes: [
        'Restore from encrypted backup requires BACKUP_ENCRYPTION_KEY to be set',
        'Algorithm must match between backup and restore (aes-256-gcm)',
        'Key rotation may affect restore compatibility for backups created with old keys'
      ],
      rotationChecklist: []
    })
  };
}

function createBackupKeyRotationPlan(services) {
  const plan = store.createPlan('key_rotation', {
    name: 'Backup Encryption Key Rotation Plan',
    status: 'planned',
    envNames: ['BACKUP_ENCRYPTION_KEY'],
    riskLevel: 'high',
    approvalRequired: true,
    steps: [
      'Generate new 256-bit encryption key',
      'Store new key in secure vault',
      'Re-encrypt existing backups with new key',
      'Update BACKUP_ENCRYPTION_KEY environment variable',
      'Verify legacy backups are re-encrypted',
      'Document key rotation in audit log'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      manualChecklist: [
        '[ ] Generate new encryption key: openssl rand -hex 32',
        '[ ] Store new key in secret vault',
        '[ ] Re-encrypt all existing backups with new key',
        '[ ] Update BACKUP_ENCRYPTION_KEY env variable',
        '[ ] Verify restore from re-encrypted backup',
        '[ ] Test application health with new key',
        '[ ] Document rotation in audit log',
        '[ ] Schedule next rotation in 90 days'
      ],
      storageRecommendations: [
        'Store backup of old key temporarily in case re-encryption fails',
        'After successful rotation, securely delete old key copies'
      ],
      riskConsiderations: 'Key rotation requires re-encrypting all existing backups. If interrupted, some backups may be inaccessible.',
      restoreCompatibilityNotes: [
        'Backups encrypted with old key must be re-encrypted with new key',
        'Keep old key accessible until all backups are migrated'
      ]
    })
  };
}

function createBackupMetadataProtectionPlan(services) {
  const plan = store.createPlan('metadata_protection', {
    name: 'Backup Metadata Protection Plan',
    status: 'planned',
    envNames: ['BACKUP_ENCRYPTION_KEY'],
    riskLevel: 'medium',
    approvalRequired: true,
    steps: [
      'Enable metadata encryption in backup encryption policy',
      'Ensure backup manifests do not contain raw secrets',
      'Add integrity verification tags to backup metadata',
      'Validate metadata completeness for all backup types',
      'Create metadata recovery procedure'
    ]
  });

  return {
    ok: true,
    plan: utils.sanitizeDrData({
      ...plan,
      metadataFields: [
        'backup_id', 'scope', 'created_at', 'size_bytes',
        'checksum', 'encryption_algorithm', 'version'
      ],
      sanitizationRules: [
        'All secret values are redacted as [REDACTED]',
        'No env values stored in metadata, only env names',
        'User PII not included in backup metadata'
      ],
      verificationSteps: [
        'Run backup integrity checker on metadata',
        'Verify no secrets exposed in backup manifests',
        'Confirm metadata encryption is enabled'
      ]
    })
  };
}

function buildBackupEncryptionChecklist(plan, services) {
  if (!plan || !plan.envNames) {
    return { ok: false, error: 'PLAN_REQUIRED' };
  }

  return {
    ok: true,
    checklist: [
      { item: 'BACKUP_ENCRYPTION_KEY env variable configured', done: Boolean(process.env.BACKUP_ENCRYPTION_KEY) },
      { item: 'Encryption algorithm set to aes-256-gcm', done: false },
      { item: 'Existing backups re-encrypted', done: false },
      { item: 'Integrity verification after encryption', done: false },
      { item: 'Restore compatibility tested in rehearsal', done: false },
      { item: 'Key rotation schedule established (every 90 days)', done: false },
      { item: 'Metadata sanitization rules applied', done: false },
      { item: 'Key stored in secure vault', done: false },
      { item: 'Setup instructions documented for recovery', done: false }
    ],
    plan: utils.sanitizeDrData(plan),
    generatedAt: utils.nowIso()
  };
}

module.exports = {
  createBackupEncryptionPlan,
  createBackupKeyRotationPlan,
  createBackupMetadataProtectionPlan,
  buildBackupEncryptionChecklist
};
