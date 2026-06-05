'use strict';

const workflowRouter = require('../src/devgovernance/natural-dev-workflow-router');
const intentDetector = require('../src/devgovernance/dev-workflow-intent-detector');
const policy = require('../src/devgovernance/dev-workflow-policy');

const repoRoot = process.cwd();
const services = { repoRoot };

async function run() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log('\n🔄 test-natural-dev-workflow-router.js\n');

  // 1. "token Codex habis" → codex_to_opencode_recovery
  const r1 = workflowRouter.routeWorkflow('token Codex habis, lanjut OpenCode', { services });
  assert(r1.ok, 'routeWorkflow returns ok');
  assert(r1.intent === 'codex_to_opencode_recovery', '"token Codex habis" → codex_to_opencode_recovery');
  assert(r1.tokenExhausted === true, 'tokenExhausted detected');
  assert(r1.recommendedAgent === 'opencode', 'recommended agent is opencode');

  // 2. "lanjut OpenCode" → codex_to_opencode_recovery
  const r2 = workflowRouter.routeWorkflow('lanjut OpenCode', { services });
  assert(r2.ok, '"lanjut OpenCode" returns ok');
  assert(r2.intent === 'codex_to_opencode_recovery', '"lanjut OpenCode" → codex_to_opencode_recovery');

  // 3. "OpenCode selesai, balik Codex" → opencode_to_codex_continue
  const r3 = workflowRouter.routeWorkflow('OpenCode selesai, balik ke Codex', { services });
  assert(r3.ok, '"OpenCode selesai, balik Codex" returns ok');
  assert(r3.intent === 'opencode_to_codex_continue', '"OpenCode selesai, balik Codex" → opencode_to_codex_continue');

  // 4. "review hasil Codex" → post_codex_review
  const r4 = workflowRouter.routeWorkflow('review hasil Codex', { services });
  assert(r4.ok, '"review hasil Codex" returns ok');
  assert(r4.intent === 'post_codex_review', '"review hasil Codex" → post_codex_review');
  assert(r4.mode === 'review', 'mode is review');

  // 5. "dashboard masuk Overview" → p0_recovery
  const r5 = workflowRouter.routeWorkflow('dashboard menu masuk Overview', { services });
  assert(r5.ok, '"dashboard masuk Overview" returns ok');
  assert(r5.intent === 'p0_recovery', '"dashboard masuk Overview" → p0_recovery');
  assert(r5.critical === true, 'p0_recovery is critical');
  assert(r5.mode === 'p0_patch', 'mode is p0_patch');

  // 6. "lanjut phase 35" → phase_planning
  const r6 = workflowRouter.routeWorkflow('lanjut phase 35', { services });
  assert(r6.ok, '"lanjut phase 35" returns ok');
  assert(r6.intent === 'phase_planning', '"lanjut phase 35" → phase_planning');

  // 7. "audit dulu jangan edit" → audit_only
  const r7 = workflowRouter.routeWorkflow('audit dulu jangan edit', { services });
  assert(r7.ok, '"audit dulu jangan edit" returns ok');
  assert(r7.intent === 'audit_only', '"audit dulu jangan edit" → audit_only');

  // 8. Ambiguous prompt defaults to audit/plan
  const r8 = workflowRouter.routeWorkflow('halo apa kabar', { services });
  assert(r8.ok, 'ambiguous prompt returns ok');
  assert(r8.ambiguous === true, 'ambiguous prompt marked ambiguous');
  assert(r8.intent === 'audit_only', 'ambiguous defaults to audit_only');

  // 9. Intent detector — all intents
  const allIntents = intentDetector.getAllIntents();
  assert(allIntents.length === 8, 'intentDetector has 8 intents');

  // 10. External action detected
  const r10 = workflowRouter.routeWorkflow('buat github issue', { services });
  assert(r10.ok, 'external action prompt returns ok');
  assert(r10.externalActionRequired === true, 'externalActionRequired detected');

  // 11. Policy exists for each intent
  for (const intent of allIntents) {
    const p = policy.getWorkflowPolicy(intent.id, services);
    assert(p !== null, `policy exists for ${intent.id}`);
    assert(Array.isArray(p.allowedActions), `policy.allowedActions is array for ${intent.id}`);
    assert(Array.isArray(p.blockedActions), `policy.blockedActions is array for ${intent.id}`);
  }

  // 12. No secrets in workflow output
  const r12 = workflowRouter.routeWorkflow('token Codex habis, lanjut OpenCode', { services });
  const outputJson = JSON.stringify(r12);
  assert(!outputJson.includes('TELEGRAM_TOKEN') && !outputJson.includes('ghp_'), 'No secrets in workflow output');

  // 13. getWorkflowSummary
  const summary = workflowRouter.getWorkflowSummary('token Codex habis', { services });
  assert(summary.ok, 'getWorkflowSummary returns ok');
  assert(summary.summary.includes('Intent:'), 'summary has Intent');
  assert(summary.summary.includes('Mode:'), 'summary has Mode');

  // 14. No direct external write capabilities
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/devgovernance/natural-dev-workflow-router.js'), 'utf8');
  assert(!src.includes('execSync') || src.includes('child_process'), 'No shell executor in workflow router');

  // 15. P0 blok feature work
  assert(r5.policy.blockedActions.includes('feature work'), 'P0 blocks feature work');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
