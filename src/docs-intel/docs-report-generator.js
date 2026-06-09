'use strict';

async function generateDocsIntelReport(inventory, gaps, freshness, commandCoverage, services = {}) {
  return {
    inventory: inventory || { summary: 'Not scanned' },
    gaps: gaps || { summary: 'Not checked' },
    freshness: freshness || { summary: 'Not reviewed' },
    commandCoverage: commandCoverage || { summary: 'Not checked' },
    summary: [
      `Inventory: ${inventory?.summary || 'N/A'}`,
      `Gaps: ${gaps?.summary || 'N/A'}`,
      `Freshness: ${typeof freshness === 'object' && freshness.length !== undefined ? `${freshness.length} warnings` : 'N/A'}`,
      `Command Coverage: ${commandCoverage?.summary || 'N/A'}`
    ].join('\n')
  };
}

module.exports = { generateDocsIntelReport };
