'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const report = await con.architectureAuditor.runArchitectureAudit(svc);

  assert(report && typeof report === 'object', 'runArchitectureAudit returns object');
  assert(typeof report.modulesFound === 'number', 'report has modulesFound');
  assert(typeof report.routeFilesFound === 'number', 'report has routeFilesFound');
  assert(typeof report.dashboardTabsFound === 'number', 'report has dashboardTabsFound');
  assert(typeof report.telegramCommandsFound === 'number', 'report has telegramCommandsFound');
  assert(typeof report.capabilitiesFound === 'number', 'report has capabilitiesFound');
  assert(typeof report.docsArchitectureMapExists === 'boolean', 'report has docsArchitectureMapExists');
  assert(report.timestamp, 'report has timestamp');
  assert(report.summary, 'report has summary');

  const modules = await con.architectureAuditor.scanModuleDirectories(svc);
  assert(typeof modules === 'object', 'scanModuleDirectories returns object');
  assert(Object.keys(modules).length > 0, 'found at least 1 module directory');

  const routes = await con.architectureAuditor.scanRouteDefinitions(svc);
  assert(Array.isArray(routes), 'scanRouteDefinitions returns array');

  const tabs = await con.architectureAuditor.scanDashboardRegistry(svc);
  assert(tabs && typeof tabs === 'object', 'scanDashboardRegistry returns object');
  assert(typeof tabs.tabCount === 'number', 'tabs.tabCount is number');

  const commands = await con.architectureAuditor.scanTelegramCommandRegistry(svc);
  assert(commands && typeof commands === 'object', 'scanTelegramCommandRegistry returns object');
  assert(typeof commands.commandCount === 'number', 'commands.commandCount is number');

  const capabilities = await con.architectureAuditor.scanGovernanceCapabilityRegistry(svc);
  assert(capabilities && typeof capabilities === 'object', 'scanGovernanceCapabilityRegistry returns object');

  const docs = await con.architectureAuditor.scanDocsArchitectureMap(svc);
  assert(docs && typeof docs === 'object', 'scanDocsArchitectureMap returns object');
  assert('exists' in docs, 'docs has exists field');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
