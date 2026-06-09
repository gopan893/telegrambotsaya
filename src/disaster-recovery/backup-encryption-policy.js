'use strict';

const utils = require('./dr-utils');

const DEFAULT_POLICY = {
  id: 'default_encryption_policy',
  workspaceId: 'default',
  encryptionRequired: false,
  algorithm: 'none',
  keySourceEnvName: 'BACKUP_ENCRYPTION_KEY',
  rotationRecommendedDays: 90,
  encryptMetadata: true,
  verifyIntegrity: true,
  createdAt: null,
  updatedAt: null
};

function getBackupEncryptionPolicy(services) {
  const policy = services && services.encryptionPolicy
    ? { ...DEFAULT_POLICY, ...services.encryptionPolicy }
    : { ...DEFAULT_POLICY };

  if (!policy.createdAt) policy.createdAt = utils.nowIso();
  if (!policy.updatedAt) policy.updatedAt = utils.nowIso();

  return policy;
}

function validateBackupEncryptionPolicy(policy, services) {
  if (!policy || typeof policy !== 'object') {
    return { ok: false, errors: ['POLICY_REQUIRED'] };
  }

  const errors = [];
  const validAlgorithms = ['aes-256-gcm', 'none'];

  if (!policy.id) errors.push('MISSING_POLICY_ID');
  if (policy.encryptionRequired !== undefined && typeof policy.encryptionRequired !== 'boolean') {
    errors.push('INVALID_ENCRYPTION_REQUIRED_TYPE');
  }
  if (policy.algorithm && !validAlgorithms.includes(policy.algorithm)) {
    errors.push(`INVALID_ALGORITHM: ${policy.algorithm}. Must be aes-256-gcm or none`);
  }
  if (policy.keySourceEnvName && policy.keySourceEnvName !== 'BACKUP_ENCRYPTION_KEY') {
    errors.push('INVALID_KEY_SOURCE_ENV_NAME: Must be BACKUP_ENCRYPTION_KEY');
  }
  if (policy.rotationRecommendedDays !== undefined && (typeof policy.rotationRecommendedDays !== 'number' || policy.rotationRecommendedDays < 1)) {
    errors.push('INVALID_ROTATION_DAYS');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, policy };
}

function detectUnencryptedBackupRisk(services) {
  const policy = getBackupEncryptionPolicy(services);
  const risks = [];

  if (!policy.encryptionRequired) {
    risks.push({
      level: 'high',
      message: 'Backup encryption is not required by policy. Unencrypted backups may expose sensitive data.'
    });
  }

  if (policy.algorithm === 'none') {
    risks.push({
      level: 'high',
      message: 'No encryption algorithm configured. Backups are stored in plain text.'
    });
  }

  if (policy.encryptionRequired && !process.env.BACKUP_ENCRYPTION_KEY) {
    risks.push({
      level: 'medium',
      message: 'Encryption is required but BACKUP_ENCRYPTION_KEY env is not configured. Set BACKUP_ENCRYPTION_KEY environment variable (name only).'
    });
  }

  if (risks.length === 0) {
    return { ok: true, encrypted: true, risks: [], policy: utils.sanitizeDrData(policy) };
  }

  return {
    ok: false,
    encrypted: false,
    risks,
    policy: utils.sanitizeDrData(policy),
    setupInstructions: [
      '1. Set BACKUP_ENCRYPTION_KEY environment variable with a 256-bit key',
      '2. Set encryptionRequired: true in the backup encryption policy',
      '3. Set algorithm to aes-256-gcm',
      '4. Verify backup integrity after encryption is enabled'
    ]
  };
}

function buildBackupEncryptionPolicyReport(services) {
  const policy = getBackupEncryptionPolicy(services);
  const encryptionCheck = detectUnencryptedBackupRisk(services);
  const validation = validateBackupEncryptionPolicy(policy, services);

  return {
    ok: validation.ok && encryptionCheck.ok,
    policy: utils.sanitizeDrData(policy),
    encryptionStatus: encryptionCheck,
    validation: validation.ok ? { ok: true } : { ok: false, errors: validation.errors },
    report: {
      encryptionEnabled: policy.encryptionRequired && policy.algorithm !== 'none',
      algorithm: policy.algorithm,
      keySource: policy.keySourceEnvName,
      rotationRecommendedDays: policy.rotationRecommendedDays,
      encryptMetadata: policy.encryptMetadata,
      verifyIntegrity: policy.verifyIntegrity,
      hasKeyConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
      risksDetected: encryptionCheck.risks.length,
      setupRequired: !encryptionCheck.ok
    },
    generatedAt: utils.nowIso()
  };
}

module.exports = {
  getBackupEncryptionPolicy,
  validateBackupEncryptionPolicy,
  detectUnencryptedBackupRisk,
  buildBackupEncryptionPolicyReport
};
