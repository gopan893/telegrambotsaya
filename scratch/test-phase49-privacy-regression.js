'use strict';

// Import all 13 privacy modules
const dataInventoryScanner = require('../src/privacy/data-inventory-scanner');
const dataClassificationEngine = require('../src/privacy/data-classification-engine');
const privacyPolicyEngine = require('../src/privacy/privacy-policy-engine');
const retentionPolicyManager = require('../src/privacy/retention-policy-manager');
const privacyAccessGuard = require('../src/privacy/privacy-access-guard');
const exportControlManager = require('../src/privacy/export-control-manager');
const exportPackageBuilder = require('../src/privacy/export-package-builder');
const archiveCleanupPlanner = require('../src/privacy/archive-cleanup-planner');
const deleteRequestManager = require('../src/privacy/delete-request-manager');
const privacyAudit = require('../src/privacy/privacy-audit');
const privacyReportGenerator = require('../src/privacy/privacy-report-generator');
const privacyStore = require('../src/privacy/privacy-store');
const privacyUtils = require('../src/privacy/privacy-utils');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

function isObject(v) { return v !== null && typeof v === 'object'; }

// 1. Full data inventory scan
const inventory = dataInventoryScanner.scanDataInventory('regression-test', {});
assert(inventory.length === 24, 'inventory has 24 categories, got ' + inventory.length);
const report = dataInventoryScanner.buildDataInventoryReport(inventory);
assert(report.totalCategories === 24, 'report totalCategories is 24');

// 2. Run classification on all categories
for (const item of inventory) {
  const cat = dataClassificationEngine.classifyDataCategory(item.category);
  assert(typeof cat === 'string', 'classified category ' + item.category + ' got ' + cat);
  assert(['public', 'internal', 'private', 'sensitive', 'secret_blocked'].includes(cat), 'valid classification for ' + item.category);
}

const classificationResults = inventory.map(i => ({ category: i.category, classification: dataClassificationEngine.classifyDataCategory(i.category) }));
const summary = dataClassificationEngine.buildClassificationSummary(classificationResults);
assert(summary.total === 24, 'classification summary total is 24, got ' + summary.total);

// 3. Test privacy policy enforcement
const moodPolicy = privacyPolicyEngine.getPrivacyPolicy('lifeos_mood_energy');
assert(moodPolicy.ownerOnly === true, 'mood energy policy is ownerOnly');

const ownerAccess = privacyPolicyEngine.evaluatePrivacyAccess({ actor: { role: 'owner' }, dataCategory: 'lifeos_mood_energy', action: 'view' });
assert(ownerAccess.allowed === true, 'owner can access mood energy');

const adminAccess = privacyPolicyEngine.evaluatePrivacyAccess({ actor: { role: 'admin' }, dataCategory: 'lifeos_mood_energy', action: 'view' });
assert(adminAccess.allowed === false, 'admin blocked from mood energy');

// 4. Test retention policy
const sessionRetention = retentionPolicyManager.getRetentionPolicy('telegram_session_context');
assert(sessionRetention.retentionDays === 30, 'session retention is 30 days');
const retentionCandidates = retentionPolicyManager.findRetentionCandidates();
assert(retentionCandidates.length > 0, 'retention candidates found');
const actionPlan = retentionPolicyManager.createRetentionActionPlan(retentionCandidates);
assert(actionPlan.candidates.length === retentionCandidates.length, 'action plan candidates match');

// 5. Create export request
const exportReq = exportControlManager.createExportRequest({ workspaceId: 'regression-test', categories: ['knowledge_graph', 'project_goals'], format: 'json' });
assert(exportReq.status === 'draft', 'export request is draft');
const exportValidation = exportControlManager.validateExportRequest(exportReq);
assert(exportValidation.valid === true, 'export request valid');

// 6. Build export manifest
const manifest = exportControlManager.buildExportManifest(exportReq);
assert(manifest.exportId === exportReq.id, 'manifest exportId matches');
const jsonPkg = exportPackageBuilder.buildJsonExportPackage(exportReq);
assert(jsonPkg.format === 'json', 'json package format correct');
assert(jsonPkg.generatedAt, 'json package has generatedAt');

// 7. Test redaction - verify no secrets in output
const secretRecord = { data: 'my token is ghp_abcdefghijklmnop' };
const redacted = exportPackageBuilder.redactExportRecord(secretRecord);
assert(redacted.redacted === true, 'secret record redacted');

const safeRecord = exportPackageBuilder.redactExportRecord({ name: 'safe' });
assert(safeRecord.redacted === undefined, 'safe record not redacted');

// 8. Create archive plan
const archivePlan = archiveCleanupPlanner.createArchiveCleanupPlan({ workspaceId: 'regression-test', categories: ['audit_logs', 'security_findings'] });
assert(archivePlan.status === 'draft', 'archive plan is draft');
const archiveProposal = archiveCleanupPlanner.createArchiveProposal(archivePlan.id);
assert(archiveProposal.status === 'pending_approval', 'archive proposal pending');

// 9. Create delete request
const deleteReq = deleteRequestManager.createDeleteRequest({ userId: 'owner1', categories: ['telegram_messages'], reason: 'cleanup' });
assert(deleteReq.status === 'draft', 'delete request is draft');
const deleteValidation = deleteRequestManager.validateDeleteRequest(deleteReq);
assert(deleteValidation.valid === true, 'delete request valid');

const unsafeDelete = deleteRequestManager.blockUnsafeHardDelete({ hardDeleteRequested: true, categories: ['audit_logs'] });
assert(unsafeDelete.blocked === true, 'unsafe hard delete blocked');

// 10. Record privacy audit
const auditEvent = privacyAudit.recordPrivacyAudit({ type: 'regression_test', userId: 'system' });
assert(auditEvent.type === 'regression_test', 'audit event recorded');
const auditList = privacyAudit.listPrivacyAudit({ type: 'regression_test' });
assert(auditList.length >= 1, 'audit event listed');
const auditSummary = privacyAudit.summarizePrivacyAudit();
assert(auditSummary.byType.regression_test >= 1, 'audit summary has regression_test');

// 11. Generate privacy report
const overviewReport = privacyReportGenerator.generatePrivacyOverviewReport('regression-test');
assert(overviewReport.type === 'overview', 'overview report type correct');
assert(overviewReport.totalCategories === 24, 'overview report totals 24 categories');

// 12. Test privacy-store and privacy-utils
privacyStore.set('test-key', { value: 123 });
const stored = privacyStore.get('test-key');
assert(stored.value === 123, 'privacy store set/get works');
const allKeys = privacyStore.keys();
assert(allKeys.includes('test-key'), 'privacy store keys includes test-key');
const id = privacyUtils.generateId();
assert(typeof id === 'string' && id.length > 0, 'privacyUtils.generateId works');

// 13. Verify no secrets leaked in any output
const allOutput = JSON.stringify({ inventory, report, classificationResults, summary, moodPolicy, sessionRetention, actionPlan, exportReq, manifest, archivePlan, deleteReq, auditEvent, overviewReport });
const secretPatterns = [/ghp_/, /sk-\w{5,}/, /Bearer\s+\S+/, /github_pat_/, /postgresql:\/\//, /DATABASE_URL/, /REDIS_URL/];
let secretFound = false;
for (const pat of secretPatterns) {
  if (pat.test(allOutput)) { secretFound = true; break; }
}
assert(secretFound === false, 'no raw secrets in any output');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
