'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const uiJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/ui.js'), 'utf8');
const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');

// Extract all renderer names from state.js
const rendererRegex = /renderer:\s*'([^']+)'/g;
let match;
const renderersFromState = [];
while ((match = rendererRegex.exec(stateJs)) !== null) {
  renderersFromState.push(match[1]);
}

// Known renderer-name to kebab-filename mapping
const RENDERER_FILE_MAP = {
  renderTelegramControl: 'telegram-control',
  renderOperatingLoop: 'operating-loop',
  renderReleaseCandidate: 'release-candidate',
  renderProductionRelease: 'production-release',
  renderDocsIntel: 'docs-intel',
  renderModelRouter: 'model-router',
  renderDisasterRecovery: 'disaster-recovery',
  renderRagKb: 'rag-kb',
  renderSelfHealing: 'selfhealing',
  renderMobile: 'mobile',
  renderLifeOS: 'lifeos',
  renderCodingWorkspace: 'coding',
  renderAgentEvaluation: 'agent-evaluation',
  renderGithubOps: 'githubops',
  renderDevGovernance: 'devgovernance',
  renderCicd: 'cicd'
};

// Check renderer exists in UI for all tabs
renderersFromState.forEach(renderer => {
  const shorthandPattern = new RegExp(`(async\\s+)?${renderer}\\s*\\(`);
  const assignmentPattern = new RegExp(`(UI\\.|window\\.UI\\.|window\\.)${renderer}\\s*=`);
  const colonPattern = new RegExp(`${renderer}:\\s*(async\\s+)?function`);
  
  let found = false;
  
  // Check in ui.js
  if (shorthandPattern.test(uiJs) || colonPattern.test(uiJs) || assignmentPattern.test(uiJs)) {
    found = true;
  }
  
  // Check in standalone tab files
  if (!found) {
    const fileName = RENDERER_FILE_MAP[renderer] || renderer.replace('render', '').toLowerCase();
    const standaloneFile = path.join(ROOT, `public/dashboard/${fileName}.js`);
    try {
      const content = fs.readFileSync(standaloneFile, 'utf8');
      found = shorthandPattern.test(content) || colonPattern.test(content) || assignmentPattern.test(content);
    } catch (_) {
      // File doesn't exist — that's OK, renderer may still exist in ui.js
    }
  }

  assert(found, `Renderer '${renderer}' exists in UI or standalone file`);
});

// Check all standalone tab files register with UI
const standaloneFiles = fs.readdirSync(path.join(ROOT, 'public/dashboard'))
  .filter(f => f.endsWith('.js') && !['ui.js', 'app.js', 'state.js', 'api.js', 'auth.js', 'pwa.js', 'utils.js', 'charts.js', 'graph.js', 'export.js', 'downloads.js', 'import-ui.js', 'realtime-monitoring.js', 'service-worker.js', 'cicd.js', 'githubops.js', 'deploy.js'].includes(f));

standaloneFiles.forEach(f => {
  const content = fs.readFileSync(path.join(ROOT, 'public/dashboard', f), 'utf8');
  const registersUi = content.includes('UI.render') || content.includes('window.UI.render');
  if (!registersUi) {
    // Some register via window.renderXxx — check at least one registration
    const hasWindowRender = /window\.render[A-Z]/.test(content);
    assert(hasWindowRender, `Standalone file ${f} registers a render function`);
  }
});

console.log(`\n=== Renderers: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
