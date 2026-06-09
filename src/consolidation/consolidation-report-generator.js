'use strict';

const utils = require('./consolidation-utils');

async function generateConsolidationReport(services = {}) {
  const auditor = require('./architecture-auditor');
  const duplicator = require('./module-duplication-detector');
  const routeCons = require('./route-registry-consolidator');
  const cmdCons = require('./command-registry-consolidator');
  const capCons = require('./capability-registry-consolidator');
  const dashAud = require('./dashboard-registry-auditor');
  const docAud = require('./docs-consistency-auditor');
  const testMap = require('./test-coverage-mapper');
  const perfCheck = require('./performance-baseline-checker');
  const roadmapGen = require('./v2-roadmap-generator');

  const auditResults = await auditor.runArchitectureAudit(services);
  const dupeModules = await duplicator.detectDuplicateModules(services);
  const dupeFunctions = await duplicator.detectDuplicateFunctionNames(services);
  const overlappingRoutes = await duplicator.detectOverlappingRouteModules(services);
  const overlappingTabs = await duplicator.detectOverlappingDashboardTabs(services);
  const commandConflicts = await duplicator.detectOverlappingTelegramCommands(services);

  const duplicationResults = { duplicateModules: dupeModules, duplicateFunctions: dupeFunctions, overlappingRoutes, overlappingTabs, commandConflicts };
  const duplicationReport = duplicator.buildDuplicationReport(duplicationResults, services);

  const allRoutes = await routeCons.auditBackendRoutes(services);
  const routeConflicts = await routeCons.detectRouteConflicts(services);
  const unprotectedRoutes = await routeCons.detectUnprotectedDashboardRoutes(services);

  const commands = await cmdCons.auditTelegramCommands(services);
  const cmdConflicts = await cmdCons.detectCommandConflicts(services);
  const cmdMissingDocs = await cmdCons.detectMissingCommandDocs(services);
  const cmdUnsafe = await cmdCons.detectUnsafeCommandRoutes(services);

  const capabilities = await capCons.auditGovernanceCapabilities(services);
  const capDuplicates = await capCons.detectCapabilityDuplicates(services);
  const capUnsafe = await capCons.detectUnsafeCapabilityConfig(services);
  const capMissingContracts = await capCons.detectMissingCapabilityContracts(services);

  const dashTabs = await dashAud.auditDashboardTabs(services);
  const missingRenderers = await dashAud.auditDashboardRenderers(services);
  const missingSidebar = await dashAud.auditDashboardSidebar(services);
  const missingAliases = await dashAud.auditDashboardAliases(services);
  const knownTabFallbacks = await dashAud.detectKnownTabFallbacks(services);

  const docs = await docAud.auditDocsConsistency(services);
  const missingModuleDocs = await docAud.detectMissingModuleDocs(services);
  const outdatedCmdDocs = await docAud.detectOutdatedCommandDocs(services);
  const outdatedEnvDocs = await docAud.detectOutdatedEnvDocs(services);
  const outdatedArchDocs = await docAud.detectOutdatedArchitectureDocs(services);

  const testMapping = await testMap.mapTestsToModules(services);
  const untestedModules = await testMap.detectModulesWithoutTests(services);
  const orphanedTests = await testMap.detectTestsForMissingModules(services);

  const bundleSize = await perfCheck.checkDashboardBundleSizeApprox(services);
  const importCost = await perfCheck.checkStartupImportCostApprox(services);
  const routeCountPerf = await perfCheck.checkRouteCount(services);
  const largeFiles = await perfCheck.checkLargeFileWarnings(services);

  const combinedServices = { ...services, auditResults: { ...auditResults, duplicationFindings: duplicationReport.findings, routeConflicts } };
  const roadmap = roadmapGen.generateV2Roadmap(combinedServices);
  const principles = roadmapGen.generateV2ArchitecturePrinciples(combinedServices);
  const refactorCandidates = roadmapGen.generateV2RefactorCandidates(combinedServices);
  const riskRegister = roadmapGen.generateV2RiskRegister(combinedServices);
  const migrationPlan = roadmapGen.generateV2MigrationPlan(combinedServices);

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      modulesFound: auditResults.modulesFound,
      routeFiles: auditResults.routeFilesFound,
      dashboardTabs: auditResults.dashboardTabsFound,
      commands: auditResults.telegramCommandsFound,
      capabilities: auditResults.capabilitiesFound,
      duplicateModules: dupeModules.length,
      duplicateFunctions: dupeFunctions.length,
      routeConflicts: routeConflicts.length,
      unprotectedRoutes: unprotectedRoutes.length,
      commandConflicts: cmdConflicts.length,
      commandMissingDocs: cmdMissingDocs.length,
      unsafeCommands: cmdUnsafe.length,
      capabilityDuplicates: capDuplicates.length,
      unsafeCapabilities: capUnsafe.length,
      missingContracts: capMissingContracts.length,
      missingRenderers: missingRenderers.length,
      missingSidebar: missingSidebar.length,
      missingAliases: missingAliases.length,
      knownTabFallbacks: knownTabFallbacks.length,
      missingDocs: Object.values(docs).filter(d => !d.exists).length,
      missingModuleDocs: missingModuleDocs.length,
      outdatedCommandDocs: outdatedCmdDocs.length,
      outdatedEnvDocs: outdatedEnvDocs.length,
      outdatedArchDocs: outdatedArchDocs.length,
      untestedModules: untestedModules.length,
      orphanedTests: orphanedTests.length,
      totalBundleSize: bundleSize.totalSize,
      totalRequires: importCost.totalRequires,
      totalRoutes: routeCountPerf.totalRoutes,
      largeFiles: largeFiles.length
    },
    sections: {
      architecture: utils.sanitizeConsolidationData(auditResults),
      duplication: utils.sanitizeConsolidationData(duplicationReport),
      routes: utils.sanitizeConsolidationData({ allRoutes, routeConflicts, unprotectedRoutes }),
      commands: utils.sanitizeConsolidationData({ commands, conflicts: cmdConflicts, missingDocs: cmdMissingDocs, unsafe: cmdUnsafe }),
      capabilities: utils.sanitizeConsolidationData({ capabilities, duplicates: capDuplicates, unsafe: capUnsafe, missingContracts: capMissingContracts }),
      dashboard: utils.sanitizeConsolidationData({ tabs: dashTabs, missingRenderers, missingSidebar, missingAliases, knownTabFallbacks }),
      docs: utils.sanitizeConsolidationData({ docs, missingModuleDocs, outdatedCommandDocs: outdatedCmdDocs, outdatedEnvDocs, outdatedArchDocs }),
      tests: utils.sanitizeConsolidationData({ testMapping, untestedModules, orphanedTests }),
      performance: utils.sanitizeConsolidationData({ bundleSize, importCost, routeCount: routeCountPerf, largeFiles }),
      roadmap: utils.sanitizeConsolidationData({ roadmap, principles, refactorCandidates, riskRegister, migrationPlan })
    }
  };

  return report;
}

async function generateConsolidationSummary(services = {}) {
  const report = await generateConsolidationReport(services);
  const s = report.summary;
  return {
    timestamp: report.timestamp,
    shortSummary: `Audit complete: ${s.modulesFound} modules, ${s.routeFiles} route files, ${s.dashboardTabs} tabs, ${s.commands} commands, ${s.capabilities} capabilities. ${s.duplicateModules} duplicate modules, ${s.routeConflicts} route conflicts, ${s.commandConflicts} command conflicts. ${s.unsafeCapabilities} unsafe capabilities. ${s.untestedModules} untested modules. ${s.missingDocs} missing docs. ${s.largeFiles} large files.`,
    keyFindings: [
      s.duplicateModules > 0 ? `Found ${s.duplicateModules} duplicate module names` : 'No duplicate modules found',
      s.routeConflicts > 0 ? `Found ${s.routeConflicts} route conflicts` : 'No route conflicts',
      s.unsafeCapabilities > 0 ? `Found ${s.unsafeCapabilities} unsafe capabilities` : 'All capabilities properly gated',
      s.untestedModules > 0 ? `Found ${s.untestedModules} untested modules` : 'All modules have tests',
      s.missingDocs > 0 ? `Found ${s.missingDocs} missing documentation files` : 'All docs present',
      s.largeFiles > 0 ? `Found ${s.largeFiles} files over 2000 lines` : 'No large files'
    ]
  };
}

module.exports = {
  generateConsolidationReport,
  generateConsolidationSummary
};
