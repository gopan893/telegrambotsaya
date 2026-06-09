'use strict';

const utils = require('./docs-intel-utils');

const DOC_PATHS = [
  'README.md', 'AGENTS.md', 'docs/AGENT_HANDOFF.md', 'docs/ARCHITECTURE_MAP.md',
  'docs/INTEGRATION_CONTRACT.md', 'docs/TESTING.md', 'docs/COMMANDS.md'
];

async function scanProjectDocs(services = {}) {
  const fs = services.fs || require('fs');
  const results = [];
  for (const p of DOC_PATHS) {
    try {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n').length;
      results.push({ path: p, exists: true, lines, empty: lines < 3 });
    } catch (e) {
      results.push({ path: p, exists: false, lines: 0, empty: true });
    }
  }
  return results;
}

async function scanDocsByCategory(category, services = {}) {
  const all = await scanProjectDocs(services);
  const catMap = {
    core: ['README.md', 'AGENTS.md'],
    handoff: ['docs/AGENT_HANDOFF.md'],
    architecture: ['docs/ARCHITECTURE_MAP.md'],
    contract: ['docs/INTEGRATION_CONTRACT.md'],
    testing: ['docs/TESTING.md'],
    commands: ['docs/COMMANDS.md']
  };
  const paths = catMap[category] || [];
  return all.filter(d => paths.includes(d.path));
}

async function detectMissingDocs(services = {}) {
  const scanned = await scanProjectDocs(services);
  return scanned.filter(d => !d.exists).map(d => d.path);
}

async function detectEmptyDocs(services = {}) {
  const scanned = await scanProjectDocs(services);
  return scanned.filter(d => d.exists && d.empty).map(d => d.path);
}

async function buildDocsInventoryReport(results = [], services = {}) {
  const total = results.length;
  const exist = results.filter(r => r.exists).length;
  const missing = results.filter(r => !r.exists).length;
  const empty = results.filter(r => r.empty).length;
  return {
    total, exist, missing, empty,
    details: results,
    summary: `${exist}/${total} docs exist. ${missing} missing, ${empty} empty/too short.`
  };
}

module.exports = { scanProjectDocs, scanDocsByCategory, detectMissingDocs, detectEmptyDocs, buildDocsInventoryReport };
