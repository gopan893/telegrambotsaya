'use strict';

const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'main'];
const VALID_TYPES = ['module', 'middleware', 'hook', 'adapter', 'theme'];

function validatePluginManifest(manifest) {
  const errors = [];
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field] || typeof manifest[field] !== 'string') {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }
  if (manifest.type && !VALID_TYPES.includes(manifest.type)) {
    errors.push(`Invalid type "${manifest.type}". Valid: ${VALID_TYPES.join(', ')}`);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push(`Invalid semver version: ${manifest.version}`);
  }
  if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
    errors.push('dependencies must be an array');
  }
  if (manifest.permissions && !Array.isArray(manifest.permissions)) {
    errors.push('permissions must be an array');
  }
  return { valid: errors.length === 0, errors };
}

function validatePluginId(pluginId) {
  return /^[a-z][a-z0-9_\-]{1,64}$/.test(String(pluginId));
}

function validateVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version));
}

module.exports = { validatePluginManifest, validatePluginId, validateVersion };
