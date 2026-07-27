'use strict';

const UNSAFE_PATTERNS = [
  /\bexec\b/i, /\bspawn\b/i, /\bsystem\b/i, /\bchild_process\b/i,
  /\brm\s+-rf\b/i, /\bformat\b/i, /\bmkfs\b/i,
  /\bcurl\b.*\|\s*sh/i, /\bwget\b.*\|\s*sh/i,
  /\bchmod\s+777\b/i, /\bsudo\b/i, /\bsu\s+-/i
];

const BLOCKED_FIELDS = ['shell', 'exec', 'spawn', 'child_process', 'eval', 'Function'];

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'], warnings: [] };
  }
  const errors = [];
  const warnings = [];
  if (!manifest.id) errors.push('Missing id');
  if (!manifest.name) errors.push('Missing name');
  if (!manifest.version) warnings.push('Missing version');
  if (manifest.type && !['module', 'adapter', 'monitor', 'checker', 'node'].includes(manifest.type)) {
    warnings.push('Unknown manifest type: ' + manifest.type);
  }
  return { valid: errors.length === 0, errors, warnings };
}

function checkUnsafePatterns(manifest) {
  const findings = [];
  const str = JSON.stringify(manifest);
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(str)) {
      findings.push({ pattern: pattern.source, severity: 'high' });
    }
  }
  return { safe: findings.length === 0, findings };
}

function checkBlockedFields(manifest) {
  const violations = [];
  for (const field of BLOCKED_FIELDS) {
    if (manifest[field] !== undefined) {
      violations.push({ field, severity: 'critical' });
    }
    if (manifest.permissions && Array.isArray(manifest.permissions)) {
      for (const perm of manifest.permissions) {
        if (String(perm).toLowerCase().includes(field.toLowerCase())) {
          violations.push({ field: 'permission:' + perm, severity: 'high' });
        }
      }
    }
  }
  return { clean: violations.length === 0, violations };
}

function checkCapabilityDeclarations(manifest) {
  const warnings = [];
  const caps = manifest.capabilities || [];
  for (const cap of caps) {
    const lower = String(cap).toLowerCase();
    if (lower.includes('shell') || lower.includes('exec') || lower.includes('system')) {
      warnings.push({ capability: cap, warning: 'Shell-related capability declared' });
    }
    if (lower.includes('write') || lower.includes('delete') || lower.includes('deploy')) {
      warnings.push({ capability: cap, warning: 'Write/delete/deploy capability declared' });
    }
  }
  return { safe: warnings.length === 0, warnings };
}

function validateDeviceManifest(manifest) {
  const manifestResult = validateManifest(manifest);
  const unsafePatterns = checkUnsafePatterns(manifest);
  const blockedFields = checkBlockedFields(manifest);
  const capabilityCheck = checkCapabilityDeclarations(manifest);

  const allPassed = manifestResult.valid && unsafePatterns.safe && blockedFields.clean && capabilityCheck.safe;
  const blockReasons = [];
  if (!manifestResult.valid) blockReasons.push('invalid_manifest');
  if (!unsafePatterns.safe) blockReasons.push('unsafe_patterns');
  if (!blockedFields.clean) blockReasons.push('blocked_fields');
  if (!capabilityCheck.safe) blockReasons.push('unsafe_capabilities');

  return {
    valid: allPassed,
    manifestResult,
    unsafePatterns,
    blockedFields,
    capabilityCheck,
    blockReasons,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  validateManifest, checkUnsafePatterns, checkBlockedFields,
  checkCapabilityDeclarations, validateDeviceManifest,
  UNSAFE_PATTERNS, BLOCKED_FIELDS
};
