'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');

const TITLE_MAP = {
  overview: ['Overview', 'System'],
  agents: ['Agents'],
  executor: ['Executor'],
  integrations: ['Integrations'],
  coding: ['Coding'],
  routines: ['Routines'],
  selfhealing: ['Self-Healing', 'Self Healing'],
  monitoring: ['Monitoring'],
  cicd: ['CI/CD', 'CICD'],
  githubops: ['GitHubOps', 'GitHub'],
  deploy: ['Deploy'],
  observability: ['Observability'],
  cost: ['Cost'],
  operator: ['Operator'],
  portfolio: ['Portfolio'],
  knowledge: ['Knowledge'],
  lifeos: ['Life OS', 'LifeOS'],
  'telegram-control': ['Telegram Control'],
  'operating-loop': ['Operating Loop'],
  improvement: ['Improvement'],
  governance: ['Governance'],
  security: ['Security'],
  privacy: ['Privacy'],
  'release-candidate': ['Release Candidate'],
  'production-release': ['Production Release'],
  reliability: ['Reliability'],
  research: ['Research'],
  'docs-intel': ['Docs', 'Documentation', 'Intelligence'],
  'model-router': ['Model Router', 'Model'],
  plugins: ['Plugin'],
  'rag-kb': ['Knowledge', 'RAG', 'Search'],
  recipes: ['Recipe'],
  mobile: ['Mobile'],
  'disaster-recovery': ['Disaster Recovery', 'Recovery'],
  consolidation: ['Consolidation'],
  'agent-evaluation': ['Agent Evaluation'],
  backup: ['Backup'],
  insights: ['Insights'],
  graph: ['Knowledge Graph'],
  benchmarks: ['Benchmarks'],
  incidents: ['Incidents'],
  ops: ['Ops'],
  workspaces: ['Workspaces'],
  users: ['Users'],
  permissions: ['Permissions'],
  memory: ['Memory'],
  goals: ['Goals'],
  workflows: ['Workflows'],
  planner: ['Planner'],
  tools: ['Tools'],
  audit: ['Audit'],
  commands: ['Commands'],
  env: ['Env', 'Environment'],
  settings: ['Settings'],
  release: ['Release'],
  'devgovernance': ['Dev Governance', 'Governance']
};

// Extract all tabs from state.js
const tabsInState = [];
const lines = stateJs.split('\n');
lines.forEach(line => {
  const m = line.match(/^\s{2}(?:'([a-z0-9_-]+)'|([a-z][a-z0-9_]*)):\s*\{/);
  if (m) tabsInState.push(m[1] || m[2]);
});

// Verify each tab in state.js has a title containing at least one expected keyword
tabsInState.forEach(tab => {
  const idx = stateJs.indexOf(tab.includes('-') ? `'${tab}':` : `\n  ${tab}:`);
  if (idx < 0) return;
  const block = stateJs.substring(idx, idx + 500);
  const titleMatch = block.match(/title:\s*'([^']+)'/);
  if (titleMatch && titleMatch[1]) {
    const title = titleMatch[1].toLowerCase();
    const keywords = TITLE_MAP[tab];
    if (keywords) {
      const hasKeyword = keywords.some(k => title.includes(k.toLowerCase()));
      if (!hasKeyword) {
        // Try partial matching
        const anyMatch = keywords.some(k => title.split(/[/,&\s]+/).some(word => word.includes(k.toLowerCase()) || k.toLowerCase().includes(word)));
        assert(hasKeyword || anyMatch, `Tab '${tab}' title "${titleMatch[1]}" contains expected keyword`);
      }
    }
  }
});

// Check all content files have content-producing renderers
// Exclude helper/utility files
const excludedFiles = new Set([
  'service-worker.js', 'state.js', 'api.js', 'auth.js', 'pwa.js',
  'utils.js', 'charts.js', 'graph.js', 'export.js', 'downloads.js',
  'import-ui.js', 'realtime-monitoring.js', 'cicd.js', 'githubops.js',
  'deploy.js', 'observability.js'
]);

const allFiles = fs.readdirSync(path.join(ROOT, 'public/dashboard'))
  .filter(f => f.endsWith('.js') && !excludedFiles.has(f));

allFiles.forEach(f => {
  const content = fs.readFileSync(path.join(ROOT, 'public/dashboard', f), 'utf8');
  // Count render function definitions (assignments to UI/window, method shorthands, or function declarations)
  const renderFns = content.match(/(async\s+)?render\w*\s*(\(|[:=]\s*(async\s+)?function|:\s*\(|[:=]\s*\(\))/g) || [];
  // Also catch patterns like: UI.renderFoo = renderFooTab or window.renderFoo = render
  const assignmentFns = content.match(/(UI|window\.UI|window)\.render\w*\s*=/g) || [];
  const totalFns = renderFns.length + assignmentFns.length;
  
  if (f !== 'notification-center.js') {
    assert(totalFns >= 1, `${f} has at least one render function (found ${totalFns})`);
  }
});

// Check ui.js has content-producing sections
const uiJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/ui.js'), 'utf8');
const contentSections = uiJs.match(/\.innerHTML\s*=/g) || [];
assert(contentSections.length > 50, 'ui.js has many content-producing sections');

console.log(`\n=== Content Validation: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
