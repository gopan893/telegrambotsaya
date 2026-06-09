'use strict';

const modelRouter = require('../src/model-router');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { env: {} };

  // Providers
  const providers = await modelRouter.modelProviderRegistry.getDefaultProviders(svc);
  assert(providers.length >= 5, 'default providers >= 5');

  // Capabilities
  const caps = await modelRouter.modelCapabilityRegistry.getDefaultCapabilities(svc);
  assert(caps.length >= 4, 'default capabilities >= 4');

  // Task classification
  const cls = modelRouter.taskModelClassifier.classifyModelTask('riset Gemini API');
  assert(cls === 'research' || cls === 'coding_architecture', 'classification for research');

  // Privacy
  const priv = modelRouter.privacyAwareRoutingPolicy.evaluateModelPrivacyPolicy({ class: 'private_lifeos', input: 'mood' }, {});
  assert(priv.isPrivate, 'private lifeos detected');

  // Cost
  const cost = modelRouter.costAwareRoutingPolicy.evaluateModelCostPolicy({ class: 'simple_chat' }, {});
  assert(cost.economyPreferred, 'simple chat prefers economy');

  // Decision engine
  const decision = await modelRouter.modelRoutingDecisionEngine.selectModelRoute({ text: 'hello' }, {}, svc);
  assert(decision && decision.selectedProvider, 'routing decision made');

  // Audit
  const audit = await modelRouter.modelRouterAudit.recordModelRouterAudit({ event: 'test', detail: 'test audit' }, svc);
  assert(audit && audit.id, 'audit recorded');

  const audits = await modelRouter.modelRouterAudit.listModelRouterAudit({}, svc);
  assert(audits.length >= 1, 'audits listed');

  // Health
  const health = await modelRouter.modelHealthChecker.checkAllModelProviders(svc);
  assert(Array.isArray(health), 'health check returns array');

  // Benchmark
  const bench = await modelRouter.modelBenchmarkRunner.runSafeModelBenchmark('smoke', svc);
  assert(bench.results && bench.results.length >= 0, 'smoke benchmark runs');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
