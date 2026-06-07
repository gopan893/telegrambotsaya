'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const research = require('../src/research');
const goldenCases = require('../src/agents/eval/evaluation-golden-cases');
const qualityGates = require('../src/agents/eval/evaluation-quality-gates');

const root = path.join(__dirname, '..');

(async () => {
  const dashboardState = fs.readFileSync(path.join(root, 'public/dashboard/state.js'), 'utf8');
  const dashboardHtml = fs.readFileSync(path.join(root, 'public/dashboard/index.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'public/dashboard/service-worker.js'), 'utf8');

  assert(dashboardState.includes('research: {'), 'Research tab registered');
  assert(dashboardState.includes("renderer: 'renderResearch'"), 'Research renderer registered');
  assert(dashboardHtml.includes('data-tab="research"'), 'Research menu item exists');
  assert(dashboardHtml.includes('/dashboard/research.js'), 'Research script included');
  assert(serviceWorker.includes('/dashboard/research.js'), 'Research asset cached as static shell');
  assert(!/\/api\/dashboard\/\*/.test(serviceWorker), 'service worker does not cache dashboard API wildcard');

  const cases = goldenCases.listGoldenCases();
  assert(cases.some(item => item.id === 'research_render_deploy_node'), 'Research deploy golden case exists');
  assert(cases.some(item => item.id === 'research_secret_source_blocked'), 'Research secret golden case exists');
  assert.strictEqual(qualityGates.DEFAULT_QUALITY_GATES.researchSafetyScore, 100, 'Research safety gate is strict');

  const services = { __researchStore: {}, workspaceId: 'default', userId: 'u1' };
  const taskResult = await research.researchTaskPlanner.createResearchTask({ topic: 'buat dokumentasi env project ini' }, services);
  assert(taskResult.ok, 'research task creation still works');
  const draft = research.documentationDraftGenerator.generateEnvDocumentation(['DATABASE_URL', 'REDIS_URL', 'TELEGRAM_TOKEN'], services);
  const draftText = JSON.stringify(draft);
  assert(draftText.includes('DATABASE_URL'), 'env names may be documented');
  assert(!draftText.includes('postgresql://'), 'env values are not documented');
  assert(!draftText.includes('123:ABC'), 'Telegram token values are not documented');

  const proposal = await research.documentationUpdatePlanner.createDocsUpdateProposal({
    topic: 'README Phase 42',
    affectedDocs: ['README.md'],
    proposedChanges: ['Add Phase 42 summary']
  }, services);
  assert(proposal.ok, 'docs proposal created');
  assert.strictEqual(proposal.proposal.directFileWrite, false, 'docs proposal does not write directly');
  assert.strictEqual(proposal.proposal.requiresExecutorApproval, true, 'docs proposal requires approval');

  console.log('test-phase43-research-regression: ok');
})();
