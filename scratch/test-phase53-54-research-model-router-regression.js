'use strict';

const research = require('../src/research');
const docsIntel = require('../src/docs-intel');
const modelRouter = require('../src/model-router');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { workspaceId: 'test', userId: 'tester', fs: require('fs'), env: {} };

  // === RESEARCH ===
  const task = await research.researchTaskManager.createResearchTask({ title: 'Regression Research', query: 'test', category: 'api_research' }, svc);
  assert(task && task.id, 'R: create task');
  assert(task.category === 'api_research', 'R: category preserved');

  const tasks = await research.researchTaskManager.listResearchTasks({}, svc);
  assert(tasks.length >= 1, 'R: list tasks');

  const fetched = await research.researchTaskManager.getResearchTask(task.id, svc);
  assert(fetched && fetched.id === task.id, 'R: get task');

  const updated = await research.researchTaskManager.updateResearchTask(task.id, { status: 'completed' }, svc);
  assert(updated && updated.status === 'completed', 'R: update task');

  // Intent classifier
  const intent = research.researchIntentClassifier.classifyResearchIntent('riset Gemini Vision API');
  assert(intent && intent.category, 'R: classify intent');

  const sensitivity = research.researchIntentClassifier.detectResearchSensitivity('private data');
  assert(sensitivity === 'high', 'R: detect sensitivity');

  // Source registry
  const src = await research.sourceRegistry.registerResearchSource({ title: 'Regression Source', type: 'official_doc', trustLevel: 'high', freshness: 'high' }, svc);
  assert(src && src.id, 'R: register source');
  assert(research.sourceRegistry.validateResearchSource(src), 'R: validate source');

  const sources = await research.sourceRegistry.listResearchSources({}, svc);
  assert(sources.length >= 1, 'R: list sources');

  const citation = research.sourceRegistry.buildSourceCitationBlock([src]);
  assert(citation.includes(src.title), 'R: citation block');

  // Quality scorer
  const quality = research.sourceQualityScorer.scoreSourceQuality(src);
  assert(quality.level === 'high', 'R: quality score high');
  assert(quality.overall > 0.5, 'R: quality overall > 0.5');

  const report = research.sourceQualityScorer.buildSourceQualityReport([src]);
  assert(report.total === 1, 'R: quality report total');

  // Notes
  const notes = research.researchNoteBuilder.createResearchNotes(task.id, [src]);
  assert(notes.notes.length === 1, 'R: create notes');

  // Comparison matrix
  const matrix = research.comparisonMatrixGenerator.generateComparisonMatrix({ options: [{ name: 'Groq' }, { name: 'Mistral' }] });
  assert(matrix.matrix.length === 2, 'R: comparison matrix');
  assert(matrix.dimensions.length > 0, 'R: comparison dimensions');

  // Implementation note
  const impNote = research.implementationNoteGenerator.generateImplementationNote(task.id);
  assert(impNote && impNote.testPlan, 'R: implementation note');

  // Risk reviewer
  const risk = research.researchRiskReviewer.reviewResearchRisk(task.id);
  assert(risk.overallRisk, 'R: risk review');

  // Prompt generator
  const prompt = research.researchPromptGenerator.generateCodexPromptFromResearch(task.id);
  assert(prompt && prompt.prompt, 'R: generate prompt');

  // Proposal bridge
  const plan = await research.researchProposalBridge.createResearchActionPlan(task.id, svc);
  assert(plan && plan.actions.length > 0, 'R: action plan');
  const proposal = await research.researchProposalBridge.createResearchExecutorProposal(plan, svc);
  assert(proposal && proposal.status === 'pending_approval', 'R: proposal pending');

  // === DOCS-INTEL ===
  const inventory = await docsIntel.docsInventoryScanner.scanProjectDocs(svc);
  assert(inventory.length >= 5, 'DI: scan inventory');

  const invReport = await docsIntel.docsInventoryScanner.buildDocsInventoryReport(inventory, svc);
  assert(invReport.summary, 'DI: inventory report');

  const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
  assert(Array.isArray(gaps), 'DI: detect gaps');

  const gapReport = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
  assert(typeof gapReport.totalGaps === 'number', 'DI: gap report');

  const freshness = await docsIntel.docsFreshnessReviewer.reviewDocsFreshness(svc);
  assert(Array.isArray(freshness), 'DI: freshness review');

  const cmds = await docsIntel.commandDocsChecker.checkCommandDocsCoverage(svc);
  assert(cmds.total > 0, 'DI: command coverage');

  const docPlan = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePlan(gapReport, svc);
  assert(docPlan.id, 'DI: update plan');

  const docProposal = await docsIntel.docsUpdatePlanGenerator.createDocsUpdateProposal(docPlan, svc);
  assert(docProposal.status === 'pending_approval', 'DI: update proposal');

  // === MODEL ROUTER ===
  const providers = await modelRouter.modelProviderRegistry.getDefaultProviders(svc);
  assert(providers.length >= 5, 'MR: default providers');

  const caps = await modelRouter.modelCapabilityRegistry.getDefaultCapabilities(svc);
  assert(caps.length >= 4, 'MR: default capabilities');

  const cls = modelRouter.taskModelClassifier.classifyModelTask('riset Gemini API');
  assert(cls === 'research' || cls === 'coding_architecture', 'MR: task classification');

  const priv = modelRouter.privacyAwareRoutingPolicy.evaluateModelPrivacyPolicy({ class: 'private_lifeos', input: 'mood' }, {});
  assert(priv.isPrivate, 'MR: privacy detection');

  const cost = modelRouter.costAwareRoutingPolicy.evaluateModelCostPolicy({ class: 'simple_chat' }, {});
  assert(cost.economyPreferred, 'MR: cost policy');

  const decision = await modelRouter.modelRoutingDecisionEngine.selectModelRoute({ text: 'hello' }, {}, svc);
  assert(decision && decision.selectedProvider, 'MR: routing decision');

  const health = await modelRouter.modelHealthChecker.checkAllModelProviders(svc);
  assert(Array.isArray(health), 'MR: health check');

  const audit = await modelRouter.modelRouterAudit.recordModelRouterAudit({ event: 'route_selected', detail: 'test', provider: 'test' }, svc);
  assert(audit && audit.id, 'MR: audit record');

  const audits = await modelRouter.modelRouterAudit.listModelRouterAudit({}, svc);
  assert(audits.length >= 1, 'MR: audit list');

  const bench = await modelRouter.modelBenchmarkRunner.runSafeModelBenchmark('smoke', svc);
  assert(bench.results, 'MR: smoke benchmark');

  const fallbackChain = await modelRouter.modelFallbackManager.createModelFallbackChain({ class: 'simple_chat' }, {}, svc);
  assert(fallbackChain.length >= 1, 'MR: fallback chain');

  // Security: no secrets in any output
  const decisionStr = JSON.stringify(decision);
  assert(!decisionStr.includes('TELEGRAM_TOKEN') && !decisionStr.includes('API_KEY'), 'SEC: no secrets in routing decision');

  // Quality gates
  assert(decision.privacyDecision === 'local_preferred' || decision.privacyDecision === 'cloud_allowed', 'GATE: privacy decision present');
  assert(decision.costDecision === 'economy' || decision.costDecision === 'quality', 'GATE: cost decision present');
  assert(typeof decision.redactionsApplied === 'boolean', 'GATE: redactions tracked');

  // Research quality gates
  assert(research.sourceQualityScorer.scoreSourceQuality(src).overall > 0, 'GATE: source quality score > 0');

  // No direct external write
  assert(proposal.status === 'pending_approval', 'GATE: proposal requires approval');
  assert(docProposal.status === 'pending_approval', 'GATE: docs proposal requires approval');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
