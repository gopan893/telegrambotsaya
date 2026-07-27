'use strict';

const REQUIRED_CONTRACT_FIELDS = ['id', 'type', 'version', 'capabilities'];
const VALID_CONNECTOR_TYPES = ['http', 'webhook', 'slack', 'discord', 'github', 'gitlab', 'jira', 'linear', 'notion', 'google_drive', 'telegram', 'custom'];

function validateContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object') return { valid: false, errors: ['Contract must be an object'] };

  for (const field of REQUIRED_CONTRACT_FIELDS) {
    if (!contract[field]) errors.push('Missing required field: ' + field);
  }

  if (contract.type && !VALID_CONNECTOR_TYPES.includes(contract.type)) {
    errors.push('Unknown connector type: ' + contract.type);
  }

  if (contract.version && !/^\d+\.\d+\.\d+/.test(contract.version)) {
    errors.push('Invalid version format');
  }

  if (contract.capabilities && !Array.isArray(contract.capabilities)) {
    errors.push('Capabilities must be an array');
  }

  return { valid: errors.length === 0, errors };
}

function checkCapabilityContract(contract, requiredCapabilities) {
  const missing = [];
  const provided = new Set(contract && contract.capabilities ? contract.capabilities : []);
  for (const cap of requiredCapabilities) {
    if (!provided.has(cap)) missing.push(cap);
  }
  return { valid: missing.length === 0, missing };
}

function validateConnectorInterface(contract) {
  const issues = [];
  if (!contract) return { valid: false, issues: ['No contract'] };

  if (typeof contract.connect !== 'function') issues.push('Missing connect() method');
  if (typeof contract.disconnect !== 'function') issues.push('Missing disconnect() method');
  if (typeof contract.getStatus !== 'function') issues.push('Missing getStatus() method');

  if (contract.type === 'read') {
    if (typeof contract.read !== 'function') issues.push('Read connector must implement read()');
  }
  if (contract.type === 'write') {
    if (typeof contract.write !== 'function') issues.push('Write connector must implement write()');
  }
  if (contract.type === 'readwrite') {
    if (typeof contract.read !== 'function') issues.push('ReadWrite connector must implement read()');
    if (typeof contract.write !== 'function') issues.push('ReadWrite connector must implement write()');
  }

  return { valid: issues.length === 0, issues };
}

function checkVersionContract(contract, minVersion) {
  if (!contract || !contract.version) return { valid: false, reason: 'No version specified' };
  const contractParts = contract.version.split('.').map(Number);
  const minParts = (minVersion || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((contractParts[i] || 0) > (minParts[i] || 0)) return { valid: true };
    if ((contractParts[i] || 0) < (minParts[i] || 0)) return { valid: false, reason: 'Version ' + contract.version + ' below minimum ' + minVersion };
  }
  return { valid: true };
}

function summarizeContract(contract) {
  if (!contract) return { valid: false };
  return {
    id: contract.id,
    type: contract.type,
    version: contract.version,
    capabilities: contract.capabilities || [],
    methods: Object.keys(contract).filter(k => typeof contract[k] === 'function')
  };
}

module.exports = {
  validateContract, checkCapabilityContract, validateConnectorInterface,
  checkVersionContract, summarizeContract,
  REQUIRED_CONTRACT_FIELDS, VALID_CONNECTOR_TYPES
};
