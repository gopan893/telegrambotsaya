'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./knowledge-utils');

const DOC_PATHS = [
  'AGENTS.md',
  'docs/AGENT_HANDOFF.md',
  'docs/ARCHITECTURE_MAP.md',
  'docs/INTEGRATION_CONTRACT.md',
  'docs/TESTING.md',
  'docs/COMMANDS.md',
  'README.md'
];

const REQUIRED_AGENTS_SECTIONS = [
  'Project Rules', 'Forbidden', 'Security', 'Approval rules',
  'Dashboard rules', 'Known dashboard tabs', 'Agent routing rules',
  'Integration rule', 'Module creation check', 'Testing rule', 'Commit rules'
];

const REQUIRED_HANDOFF_SECTIONS = ['Session Log', 'Files Changed', 'Tests Run'];

const REQUIRED_TESTING_SECTIONS = ['Mandatory Pre/Post-Check', 'Reporting Rules'];

function readDocSafe(rootDir, relPath) {
  try {
    const abs = path.join(rootDir, relPath);
    if (!fs.existsSync(abs)) return { exists: false, content: '', size: 0 };
    const content = fs.readFileSync(abs, 'utf8');
    return { exists: true, content, size: content.length };
  } catch (_) {
    return { exists: false, content: '', size: 0, error: true };
  }
}

function detectMissingSection(content, required) {
  if (!content) return required.slice();
  return required.filter(section => !content.includes(section));
}

function scanProjectDocs(services = {}) {
  const rootDir = services.rootDir || path.resolve(__dirname, '..', '..');
  const out = {};
  for (const rel of DOC_PATHS) {
    out[rel] = readDocSafe(rootDir, rel);
  }
  return out;
}

function detectDocsOutOfSync(services = {}) {
  const docs = scanProjectDocs(services);
  const findings = [];
  for (const [rel, info] of Object.entries(docs)) {
    if (!info.exists) {
      findings.push({ file: rel, severity: 'high', issue: 'missing' });
      continue;
    }
    if (info.size < 200) {
      findings.push({ file: rel, severity: 'medium', issue: 'too_short' });
    }
  }
  return findings;
}

function detectMissingPhaseDocs(services = {}) {
  const docs = scanProjectDocs(services);
  const arch = docs['docs/ARCHITECTURE_MAP.md'];
  const handoff = docs['docs/AGENT_HANDOFF.md'];
  const findings = [];
  const hasPhaseMarkers = (content) => /Phase\s+\d+/i.test(content || '');
  if (arch.exists && !hasPhaseMarkers(arch.content)) {
    findings.push({ file: 'docs/ARCHITECTURE_MAP.md', issue: 'no_phase_markers' });
  }
  if (handoff.exists && !hasPhaseMarkers(handoff.content)) {
    findings.push({ file: 'docs/AGENT_HANDOFF.md', issue: 'no_phase_markers' });
  }
  return findings;
}

function detectMissingEnvDocs(services = {}) {
  const envExamplePath = services.envExamplePath || path.join(services.rootDir || path.resolve(__dirname, '..', '..'), '.env.example');
  const docs = scanProjectDocs(services);
  const readme = docs['README.md'];
  const findings = [];
  let envKeys = [];
  if (fs.existsSync(envExamplePath)) {
    envKeys = fs.readFileSync(envExamplePath, 'utf8')
      .split(/\r?\n/)
      .filter(line => /^[A-Z0-9_]+=/.test(line))
      .map(line => line.split('=')[0]);
  }
  if (!readme.exists) {
    findings.push({ file: 'README.md', issue: 'missing' });
    return findings;
  }
  const readmeContent = readme.content || '';
  const missing = envKeys.filter(k => !readmeContent.includes(k));
  if (missing.length) {
    findings.push({
      file: 'README.md',
      issue: 'missing_env_docs',
      keys: missing.slice(0, 30)
    });
  }
  return findings;
}

function detectArchitectureMapGaps(services = {}) {
  const docs = scanProjectDocs(services);
  const arch = docs['docs/ARCHITECTURE_MAP.md'];
  if (!arch.exists) {
    return [{ file: 'docs/ARCHITECTURE_MAP.md', issue: 'missing' }];
  }
  const findings = [];
  const hasTabs = /Dashboard Tabs/i.test(arch.content);
  if (!hasTabs) findings.push({ file: 'docs/ARCHITECTURE_MAP.md', issue: 'no_dashboard_tabs_section' });
  const hasRoutes = /Backend Dashboard Routes|Routes/i.test(arch.content);
  if (!hasRoutes) findings.push({ file: 'docs/ARCHITECTURE_MAP.md', issue: 'no_routes_section' });
  return findings;
}

function detectHandoffGaps(services = {}) {
  const docs = scanProjectDocs(services);
  const handoff = docs['docs/AGENT_HANDOFF.md'];
  if (!handoff.exists) {
    return [{ file: 'docs/AGENT_HANDOFF.md', issue: 'missing' }];
  }
  return detectMissingSection(handoff.content, REQUIRED_HANDOFF_SECTIONS)
    .map(s => ({ file: 'docs/AGENT_HANDOFF.md', issue: 'missing_section', section: s }));
}

function detectAgentsGaps(services = {}) {
  const docs = scanProjectDocs(services);
  const agents = docs['AGENTS.md'];
  if (!agents.exists) {
    return [{ file: 'AGENTS.md', issue: 'missing' }];
  }
  return detectMissingSection(agents.content, REQUIRED_AGENTS_SECTIONS)
    .map(s => ({ file: 'AGENTS.md', issue: 'missing_section', section: s }));
}

function detectTestingGaps(services = {}) {
  const docs = scanProjectDocs(services);
  const testing = docs['docs/TESTING.md'];
  if (!testing.exists) {
    return [{ file: 'docs/TESTING.md', issue: 'missing' }];
  }
  return detectMissingSection(testing.content, REQUIRED_TESTING_SECTIONS)
    .map(s => ({ file: 'docs/TESTING.md', issue: 'missing_section', section: s }));
}

function suggestDocumentationUpdates(services = {}) {
  const findings = [
    ...detectDocsOutOfSync(services).map(f => ({ ...f, category: 'docs_out_of_sync' })),
    ...detectMissingPhaseDocs(services).map(f => ({ ...f, category: 'missing_phase_docs' })),
    ...detectMissingEnvDocs(services).map(f => ({ ...f, category: 'missing_env_docs' })),
    ...detectArchitectureMapGaps(services).map(f => ({ ...f, category: 'arch_map_gap' })),
    ...detectHandoffGaps(services).map(f => ({ ...f, category: 'handoff_gap' })),
    ...detectAgentsGaps(services).map(f => ({ ...f, category: 'agents_gap' })),
    ...detectTestingGaps(services).map(f => ({ ...f, category: 'testing_gap' }))
  ];
  return {
    findings,
    proposalRequired: findings.length > 0,
    noDirectEdit: true,
    generatedAt: utils.nowIso()
  };
}

module.exports = {
  DOC_PATHS,
  REQUIRED_AGENTS_SECTIONS,
  REQUIRED_HANDOFF_SECTIONS,
  REQUIRED_TESTING_SECTIONS,
  scanProjectDocs,
  detectDocsOutOfSync,
  detectMissingPhaseDocs,
  detectMissingEnvDocs,
  detectArchitectureMapGaps,
  detectHandoffGaps,
  detectAgentsGaps,
  detectTestingGaps,
  suggestDocumentationUpdates
};
