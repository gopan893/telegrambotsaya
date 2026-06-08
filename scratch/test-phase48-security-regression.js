'use strict';

let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// Import all 14 security modules
const scanner = require('../src/security/secret-surface-scanner');
const classifier = require('../src/security/secret-finding-classifier');
const rotationPlanner = require('../src/security/credential-rotation-planner');
const envDriftDetector = require('../src/security/env-drift-detector');
const permissionAuditor = require('../src/security/permission-auditor');
const capabilityAuditor = require('../src/security/capability-risk-auditor');
const bypassAuditor = require('../src/security/approval-bypass-auditor');
const redteamSim = require('../src/security/redteam-simulator');
const injectionTester = require('../src/security/prompt-injection-tester');
const scorecard = require('../src/security/security-scorecard');
const proposalBridge = require('../src/security/security-proposal-bridge');
const auditStore = require('../src/security/security-audit-store');
const reportGen = require('../src/security/security-report-generator');
const secUtils = require('../src/security/security-utils');

assert(scanner.scanTextForSecrets, '1: secret-surface-scanner loaded');
assert(classifier.classifySecretFinding, '2: secret-finding-classifier loaded');
assert(rotationPlanner.createTelegramTokenRotationPlan, '3: credential-rotation-planner loaded');
assert(envDriftDetector.detectEnvDrift, '4: env-drift-detector loaded');
assert(permissionAuditor.auditOwnerAdminPermissions, '5: permission-auditor loaded');
assert(capabilityAuditor.auditDangerousCapabilities, '6: capability-risk-auditor loaded');
assert(bypassAuditor.auditApprovalBypassPaths, '7: approval-bypass-auditor loaded');
assert(redteamSim.buildDefaultRedTeamCases, '8: redteam-simulator loaded');
assert(injectionTester.detectPromptInjectionAttempt, '9: prompt-injection-tester loaded');
assert(scorecard.calculateSecurityScorecard, '10: security-scorecard loaded');
assert(proposalBridge.createSecurityRepairPlan, '11: security-proposal-bridge loaded');
assert(auditStore.createAuditRun, '12: security-audit-store loaded');
assert(reportGen.generateFullSecurityReport, '13: security-report-generator loaded');
assert(secUtils.generateId, '14: security-utils loaded');

// Run secret scan
const secretFindings = scanner.scanTextForSecrets('TELEGRAM_TOKEN=abc123', 'env', '.env');
assert(secretFindings.length > 0, 'Secret scan finds TELEGRAM_TOKEN');
const classified = secretFindings.map(f => classifier.classifySecretFinding(f)).filter(Boolean);
assert(classified.length > 0, 'Classified findings created');

// Run env drift detection
const testEnv = {
  env: {
    NODE_ENV: 'development', PORT: '3000', WEBHOOK_URL: 'https://example.com',
    TELEGRAM_TOKEN: 'x', OWNER_CHAT_ID: '1', ADMIN_IDS: '1',
    DASHBOARD_ADMIN_TOKEN: 'x', STORAGE_DRIVER: 'postgres',
    DATABASE_URL: 'x', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'x'
  }
};
const driftResults = envDriftDetector.detectEnvDrift(testEnv);
assert(Array.isArray(driftResults), 'Env drift returns array');

const driftReport = envDriftDetector.buildEnvDriftReport(driftResults);
assert(driftReport.totalIssues >= 0, 'Drift report has totalIssues');

// Run permission audit
const permResults = permissionAuditor.auditOwnerAdminPermissions(testEnv);
const permReport = permissionAuditor.buildPermissionAuditReport([permResults]);
assert(permReport.totalFindings >= 0, 'Permission report has findings');

// Run capability audit (no governance available)
const capResults = capabilityAuditor.auditDangerousCapabilities({});
const capReport = capabilityAuditor.buildCapabilityRiskReport([capResults]);
assert(capReport.totalFindings >= 0, 'Capability report has findings');

// Run bypass audit
const bypassPaths = bypassAuditor.auditApprovalBypassPaths({});
const bypassReport = bypassAuditor.buildApprovalBypassReport([bypassPaths]);
assertEq(bypassReport.totalPaths, 9, 'Bypass audit reports 9 paths');
assert(bypassReport.allBlocked === true, 'All bypass paths blocked');

// Run red-team suite
const rtResults = redteamSim.runRedTeamSuite('full', {});
assertEq(rtResults.total, 13, 'Red-team suite runs 13 cases');
assertEq(rtResults.score, 100, 'Red-team suite scores 100');

// Generate scorecard
const sc = scorecard.calculateSecurityScorecard({
  secretResults: { findings: secretFindings },
  envResults: { issues: driftResults },
  permissionResults: permReport,
  capabilityResults: capReport,
  approvalResults: bypassReport,
  redTeamResults: rtResults
});
assert(typeof sc.overallScore === 'number', 'Scorecard has overallScore');

// Create rotation plan
const rotPlan = rotationPlanner.createTelegramTokenRotationPlan(classified);
assert(rotPlan.credentialType === 'TELEGRAM_TOKEN', 'Rotation plan for TELEGRAM_TOKEN');

// Build checklist
const checklist = rotationPlanner.buildRotationChecklist(rotPlan);
assert(typeof checklist === 'string', 'Checklist is a string');
assert(checklist.length > 0, 'Checklist not empty');

// Verify no secrets in any output
const allOutputs = JSON.stringify({
  secretFindings, classified, driftResults, permReport, capReport, bypassReport, rtResults, sc, rotPlan
});
assert(!allOutputs.includes('[REDACTED_SECRET]'), 'No redacted secret marker in outputs');
assert(!allOutputs.includes('ghp_'), 'No ghp_ tokens in outputs');

// Create security proposal
const repairPlan = proposalBridge.createSecurityRepairPlan(classified[0]);
assert(repairPlan.id, 'Repair plan has id');
const execProposal = proposalBridge.createSecurityExecutorProposal(repairPlan);
assert(execProposal.requiresEvaluationV2 === true, 'Executor proposal requires Evaluation v2');

// Dashboard routes load
const secRoutes = require('../src/dashboard/security-routes');
assert(typeof secRoutes.registerSecurityRoutes === 'function', 'Security routes module loaded');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
