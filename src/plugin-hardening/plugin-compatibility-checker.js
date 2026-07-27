'use strict';

const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'main'];
const SUPPORTED_TYPES = ['module', 'middleware', 'hook', 'adapter', 'theme'];
const SUPPORTED_NODE_VERSIONS = ['>=18.0.0'];
const AI_OS_MIN_VERSION = '1.0.0';

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['Manifest must be an object'] };
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field]) errors.push('Missing required field: ' + field);
  }
  if (manifest.type && !SUPPORTED_TYPES.includes(manifest.type)) {
    errors.push('Unsupported plugin type: ' + manifest.type);
  }
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Invalid version format (expected semver)');
  }
  return { valid: errors.length === 0, errors };
}

function checkNodeCompatibility(manifest) {
  const warnings = [];
  const nodeEngine = manifest.engines && manifest.engines.node;
  if (!nodeEngine) {
    warnings.push('No node engine specified');
  } else if (nodeEngine.includes('<18') || nodeEngine.includes('<16')) {
    warnings.push('Plugin requires older Node.js version: ' + nodeEngine);
  }
  return { compatible: warnings.length === 0, warnings };
}

function checkAiOsCompatibility(manifest) {
  const warnings = [];
  const osVersion = manifest.aiOsVersion || manifest.aios_version;
  if (!osVersion) {
    warnings.push('No AI OS version specified');
  } else if (osVersion !== '*' && osVersion !== AI_OS_MIN_VERSION) {
    warnings.push('Targeting AI OS version ' + osVersion + ', current is ' + AI_OS_MIN_VERSION);
  }
  return { compatible: warnings.length === 0, warnings };
}

function checkDependencyCompatibility(manifest, installedPlugins) {
  const warnings = [];
  const deps = manifest.dependencies || {};
  for (const [depId, depVersion] of Object.entries(deps)) {
    const installed = installedPlugins.find(p => p.id === depId);
    if (!installed) {
      warnings.push('Missing dependency: ' + depId);
    } else if (depVersion && installed.version && !satisfiesVersion(installed.version, depVersion)) {
      warnings.push('Dependency version mismatch: ' + depId + ' (need ' + depVersion + ', got ' + installed.version + ')');
    }
  }
  return { compatible: warnings.length === 0, warnings };
}

function satisfiesVersion(current, range) {
  if (!current || !range) return true;
  if (range === '*') return true;
  const minVersion = range.replace(/[>=<^~]/g, '').trim();
  if (!minVersion) return true;
  const currentParts = current.split('.').map(Number);
  const minParts = minVersion.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((currentParts[i] || 0) > (minParts[i] || 0)) return true;
    if ((currentParts[i] || 0) < (minParts[i] || 0)) return false;
  }
  return true;
}

function checkConnectorCompatibility(manifest, registeredConnectors) {
  const warnings = [];
  const connectorReqs = manifest.connectors || [];
  for (const conn of connectorReqs) {
    const connId = typeof conn === 'string' ? conn : conn.id;
    const found = registeredConnectors.find(c => c.id === connId || c.type === connId);
    if (!found) {
      warnings.push('Connector not registered: ' + connId);
    }
  }
  return { compatible: warnings.length === 0, warnings };
}

function runFullCompatibilityCheck(manifest, context) {
  const installedPlugins = (context && context.installedPlugins) || [];
  const registeredConnectors = (context && context.registeredConnectors) || [];

  const manifestCheck = validateManifest(manifest);
  const nodeCheck = checkNodeCompatibility(manifest);
  const osCheck = checkAiOsCompatibility(manifest);
  const depCheck = checkDependencyCompatibility(manifest, installedPlugins);
  const connCheck = checkConnectorCompatibility(manifest, registeredConnectors);

  const allWarnings = [...nodeCheck.warnings, ...osCheck.warnings, ...depCheck.warnings, ...connCheck.warnings];
  const compatible = manifestCheck.valid && nodeCheck.compatible && osCheck.compatible && depCheck.compatible && connCheck.compatible;

  return {
    compatible,
    manifestValid: manifestCheck.valid,
    manifestErrors: manifestCheck.errors,
    nodeCompatible: nodeCheck.compatible,
    nodeWarnings: nodeCheck.warnings,
    aiOsCompatible: osCheck.compatible,
    aiOsWarnings: osCheck.warnings,
    dependenciesCompatible: depCheck.compatible,
    dependencyWarnings: depCheck.warnings,
    connectorsCompatible: connCheck.compatible,
    connectorWarnings: connCheck.warnings,
    allWarnings
  };
}

module.exports = {
  validateManifest, checkNodeCompatibility, checkAiOsCompatibility,
  checkDependencyCompatibility, checkConnectorCompatibility,
  runFullCompatibilityCheck
};
