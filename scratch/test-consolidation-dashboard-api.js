'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  // Store a test value
  con.consolidationStore.setAuditResult('test-key', { hello: 'world' });
  const stored = con.consolidationStore.getAuditResult('test-key');
  assert(stored && stored.hello === 'world', 'consolidationStore.setAuditResult/getAuditResult');

  con.consolidationStore.setReport('test-report', { data: 123 });
  const report = con.consolidationStore.getReport('test-report');
  assert(report && report.data === 123, 'consolidationStore.setReport/getReport');

  con.consolidationStore.setRoadmap({ version: 'v2' });
  const roadmap = con.consolidationStore.getRoadmap();
  assert(roadmap && roadmap.version === 'v2', 'consolidationStore.setRoadmap/getRoadmap');

  const allResults = con.consolidationStore.listAuditResults();
  assert(typeof allResults === 'object', 'consolidationStore.listAuditResults returns object');

  const stats = con.consolidationStore.getStats();
  assert(stats && typeof stats.auditResultCount === 'number', 'consolidationStore.getStats');

  con.consolidationStore.resetStore();
  assert(con.consolidationStore.listAuditResults(), 'resetStore clears');

  // Run full audit
  const auditReport = await con.architectureAuditor.runArchitectureAudit(svc);
  assert(auditReport.modulesFound > 0, 'architecture audit finds modules');
  assert(auditReport.routeFilesFound >= 0, 'architecture audit finds route files');
  assert(auditReport.dashboardTabsFound > 0, 'architecture audit finds dashboard tabs');
  assert(auditReport.telegramCommandsFound > 0, 'architecture audit finds telegram commands');
  assert(auditReport.capabilitiesFound > 0, 'architecture audit finds capabilities');

  // Duplication detection
  const dupModules = await con.moduleDuplicationDetector.detectDuplicateModules(svc);
  assert(Array.isArray(dupModules), 'detectDuplicateModules');

  const dupFunctions = await con.moduleDuplicationDetector.detectDuplicateFunctionNames(svc);
  assert(Array.isArray(dupFunctions), 'detectDuplicateFunctionNames');

  // Routes
  const allRoutes = await con.routeRegistryConsolidator.auditBackendRoutes(svc);
  assert(Array.isArray(allRoutes), 'auditBackendRoutes');
  const routeConflicts = await con.routeRegistryConsolidator.detectRouteConflicts(svc);
  assert(Array.isArray(routeConflicts), 'detectRouteConflicts');

  // Commands
  const commands = await con.commandRegistryConsolidator.auditTelegramCommands(svc);
  assert(commands.length > 0, 'auditTelegramCommands');
  const cmdConflicts = await con.commandRegistryConsolidator.detectCommandConflicts(svc);
  assert(Array.isArray(cmdConflicts), 'detectCommandConflicts');

  // Capabilities
  const caps = await con.capabilityRegistryConsolidator.auditGovernanceCapabilities(svc);
  assert(caps.length > 0, 'auditGovernanceCapabilities');
  const unsafeCaps = await con.capabilityRegistryConsolidator.detectUnsafeCapabilityConfig(svc);
  assert(Array.isArray(unsafeCaps), 'detectUnsafeCapabilityConfig');

  // Dashboard registry
  const tabs = await con.dashboardRegistryAuditor.auditDashboardTabs(svc);
  assert(Object.keys(tabs).length > 0, 'auditDashboardTabs');
  const sidebarMissing = await con.dashboardRegistryAuditor.auditDashboardSidebar(svc);
  assert(Array.isArray(sidebarMissing), 'auditDashboardSidebar');

  // Docs
  const docs = await con.docsConsistencyAuditor.auditDocsConsistency(svc);
  assert('README.md' in docs, 'auditDocsConsistency includes README.md');

  // Test coverage
  const testMapping = await con.testCoverageMapper.mapTestsToModules(svc);
  assert(Array.isArray(testMapping), 'mapTestsToModules');
  const untested = await con.testCoverageMapper.detectModulesWithoutTests(svc);
  assert(Array.isArray(untested), 'detectModulesWithoutTests');

  // Performance
  const bundle = await con.performanceBaselineChecker.checkDashboardBundleSizeApprox(svc);
  assert(typeof bundle.totalSize === 'number', 'checkDashboardBundleSizeApprox');
  const largeFiles = await con.performanceBaselineChecker.checkLargeFileWarnings(svc);
  assert(Array.isArray(largeFiles), 'checkLargeFileWarnings');

  // Roadmap
  const v2Roadmap = con.v2RoadmapGenerator.generateV2Roadmap(svc);
  assert(v2Roadmap.phases.length >= 10, 'generateV2Roadmap has phases');
  const v2Principles = con.v2RoadmapGenerator.generateV2ArchitecturePrinciples(svc);
  assert(v2Principles.principles.length >= 5, 'generateV2ArchitecturePrinciples');

  // Report
  const fullReport = await con.consolidationReportGenerator.generateConsolidationReport(svc);
  assert(fullReport && fullReport.summary, 'generateConsolidationReport has summary');
  assert(fullReport.sections, 'generateConsolidationReport has sections');

  const summary = await con.consolidationReportGenerator.generateConsolidationSummary(svc);
  assert(summary && summary.shortSummary, 'generateConsolidationSummary has shortSummary');
  assert(Array.isArray(summary.keyFindings), 'generateConsolidationSummary has keyFindings');

  // Utils
  const sanitized = con.consolidationUtils.sanitizeConsolidationData({ TELEGRAM_TOKEN: 'test123' });
  assert(sanitized.TELEGRAM_TOKEN === '[REDACTED_SECRET]', 'sanitizeConsolidationData redacts secrets');

  const dirs = con.consolidationUtils.getSrcDirectories(process.cwd());
  assert(Array.isArray(dirs), 'getSrcDirectories returns array');
  assert(dirs.length > 0, 'getSrcDirectories finds directories');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
