'use strict';

const inventory = require('./docs-inventory-scanner');
const utils = require('./docs-intel-utils');

async function detectDocsGaps(services = {}) {
  const gaps = [];
  gaps.push(...await detectCommandDocsGaps(services));
  gaps.push(...await detectDashboardDocsGaps(services));
  gaps.push(...await detectArchitectureDocsGaps(services));
  gaps.push(...await detectEnvDocsGaps(services));
  gaps.push(...await detectTestingDocsGaps(services));
  return gaps;
}

async function detectCommandDocsGaps(services = {}) {
  const gaps = [];
  try {
    const fs = services.fs || require('fs');
    const commandsMd = fs.readFileSync('docs/COMMANDS.md', 'utf8');
    const hasPhase53 = /Phase 53|Phase 54|research|docs.intel|model.router/i.test(commandsMd);
    if (!hasPhase53) gaps.push({ type: 'command_docs', severity: 'medium', detail: 'Phase 53-54 commands not documented in COMMANDS.md' });
  } catch (_) {
    gaps.push({ type: 'command_docs', severity: 'high', detail: 'COMMANDS.md not found' });
  }
  return gaps;
}

async function detectDashboardDocsGaps(services = {}) {
  const gaps = [];
  try {
    const fs = services.fs || require('fs');
    const arch = fs.readFileSync('docs/ARCHITECTURE_MAP.md', 'utf8');
    if (!/research/i.test(arch)) gaps.push({ type: 'dashboard_docs', severity: 'medium', detail: 'Research dashboard tab not documented in ARCHITECTURE_MAP.md' });
    if (!/docs.intel|docs-intel|documentation.intelligence/i.test(arch)) gaps.push({ type: 'dashboard_docs', severity: 'medium', detail: 'Docs Intel dashboard tab not documented in ARCHITECTURE_MAP.md' });
    if (!/model.router|model.router/i.test(arch)) gaps.push({ type: 'dashboard_docs', severity: 'medium', detail: 'Model Router dashboard tab not documented in ARCHITECTURE_MAP.md' });
  } catch (_) {}
  return gaps;
}

async function detectArchitectureDocsGaps(services = {}) {
  const gaps = [];
  try {
    const fs = services.fs || require('fs');
    for (const p of ['src/research', 'src/docs-intel', 'src/model-router']) {
      try {
        fs.accessSync(p);
      } catch (_) {
        gaps.push({ type: 'architecture_docs', severity: 'low', detail: `Module directory ${p} exists but may not be documented in ARCHITECTURE_MAP.md` });
      }
    }
  } catch (_) {}
  return gaps;
}

async function detectEnvDocsGaps(services = {}) {
  const gaps = [];
  const envVars = ['LOCAL_AI_ENABLED', 'LOCAL_AI_PROVIDER', 'LOCAL_AI_BASE_URL', 'AI_PROVIDER'];
  try {
    const fs = services.fs || require('fs');
    const readme = fs.readFileSync('README.md', 'utf8');
    for (const ev of envVars) {
      if (!readme.includes(ev)) gaps.push({ type: 'env_docs', severity: 'low', detail: `Env var ${ev} not documented in README.md` });
    }
  } catch (_) {}
  return gaps;
}

async function detectTestingDocsGaps(services = {}) {
  const gaps = [];
  try {
    const fs = services.fs || require('fs');
    const testing = fs.readFileSync('docs/TESTING.md', 'utf8');
    if (!/research/i.test(testing)) gaps.push({ type: 'testing_docs', severity: 'medium', detail: 'No research test section in TESTING.md' });
    if (!/docs.intel|docs-intel/i.test(testing)) gaps.push({ type: 'testing_docs', severity: 'medium', detail: 'No docs-intel test section in TESTING.md' });
    if (!/model.router/i.test(testing)) gaps.push({ type: 'testing_docs', severity: 'medium', detail: 'No model-router test section in TESTING.md' });
  } catch (_) {}
  return gaps;
}

async function generateDocsGapReport(services = {}) {
  const gaps = await detectDocsGaps(services);
  return {
    totalGaps: gaps.length,
    high: gaps.filter(g => g.severity === 'high').length,
    medium: gaps.filter(g => g.severity === 'medium').length,
    low: gaps.filter(g => g.severity === 'low').length,
    gaps,
    summary: `${gaps.length} docs gap(s) detected. ${gaps.filter(g => g.severity === 'high').length} high, ${gaps.filter(g => g.severity === 'medium').length} medium, ${gaps.filter(g => g.severity === 'low').length} low.`
  };
}

module.exports = { detectDocsGaps, detectCommandDocsGaps, detectDashboardDocsGaps, detectArchitectureDocsGaps, detectEnvDocsGaps, detectTestingDocsGaps, generateDocsGapReport };
