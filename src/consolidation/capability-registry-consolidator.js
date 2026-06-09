'use strict';

const fs = require('fs');
const path = require('path');

const BASE = path.join(process.cwd());

async function auditGovernanceCapabilities(services = {}) {
  const capPath = path.join(BASE, 'src', 'governance', 'capability-registry.js');
  try {
    const content = fs.readFileSync(capPath, 'utf8');
    const capabilities = [];
    const sections = content.split('\n').filter(l => l.includes('module:') && l.includes('name:'));
    for (const line of sections) {
      const modMatch = line.match(/module:\s*['"`]([^'"`]+)['"`]/);
      const nameMatch = line.match(/name:\s*['"`]([^'"`]+)['"`]/);
      if (modMatch && nameMatch) {
        capabilities.push({ module: modMatch[1], name: nameMatch[1] });
      }
    }
    return capabilities;
  } catch (_) {
    return [];
  }
}

async function detectCapabilityDuplicates(services = {}) {
  const caps = await auditGovernanceCapabilities(services);
  const keyCount = {};
  for (const cap of caps) {
    const key = `${cap.module}.${cap.name}`;
    keyCount[key] = (keyCount[key] || 0) + 1;
  }
  return Object.entries(keyCount)
    .filter(([_, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

async function detectUnsafeCapabilityConfig(services = {}) {
  const capPath = path.join(BASE, 'src', 'governance', 'capability-registry.js');
  try {
    const content = fs.readFileSync(capPath, 'utf8');
    const unsafe = [];

    const blocks = content.split(/\n\s*\{/);
    for (const block of blocks) {
      const actionTypeMatch = block.match(/actionType:\s*['"`]([^'"`]+)['"`]/);
      const nameMatch = block.match(/name:\s*['"`]([^'"`]+)['"`]/);
      const evalMatch = block.includes('requiresEvaluation: true');
      const execMatch = block.includes('requiresExecutorApproval: true');
      const enabledMatch = block.match(/enabled:\s*(true|false)/);

      if (actionTypeMatch && (actionTypeMatch[1] === 'external_write' || actionTypeMatch[1] === 'dangerous')) {
        const enabled = enabledMatch ? enabledMatch[1] === 'true' : true;
        if (enabled && (!evalMatch || !execMatch)) {
          unsafe.push({
            name: nameMatch ? nameMatch[1] : 'unknown',
            actionType: actionTypeMatch[1],
            hasEvaluation: evalMatch,
            hasExecutorApproval: execMatch,
            issue: 'Dangerous capability without required approval gates'
          });
        }
      }
    }

    return unsafe;
  } catch (_) {
    return [];
  }
}

async function detectMissingCapabilityContracts(services = {}) {
  const capPath = path.join(BASE, 'src', 'governance', 'capability-registry.js');
  const contractPath = path.join(BASE, 'docs', 'CAPABILITY_CONTRACTS.md');
  try {
    const capContent = fs.readFileSync(capPath, 'utf8');
    const capNames = [];
    const capMatches = capContent.matchAll(/name:\s*['"`]([^'"`]+)['"`]/g);
    for (const m of capMatches) capNames.push(m[1]);

    let contractContent = '';
    try {
      contractContent = fs.readFileSync(contractPath, 'utf8');
    } catch (_) {
      return capNames.map(n => ({ capability: n, hasContract: false, issue: 'No CAPABILITY_CONTRACTS.md found' }));
    }

    const missing = [];
    for (const name of capNames) {
      if (!contractContent.includes(name)) {
        missing.push({ capability: name, hasContract: false, issue: 'Missing contract documentation' });
      }
    }
    return missing;
  } catch (_) {
    return [];
  }
}

function buildCapabilityRegistryReport(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Capability registry consolidation report',
    rules: [
      'external_write/danger must be proposal-only',
      'Shell executor blocked',
      'Deploy/rollback/push/release/write must require Evaluation v2 + executor approval'
    ]
  };
}

module.exports = {
  auditGovernanceCapabilities,
  detectCapabilityDuplicates,
  detectUnsafeCapabilityConfig,
  detectMissingCapabilityContracts,
  buildCapabilityRegistryReport
};
