'use strict';

const crypto = require('crypto');
const guards = require('./dashboard-guards');
const auth = require('./dashboard-auth');

function registerSecurityRoutes(router, services) {
  const env = services.env || process.env;
  const dashboardAuth = auth.createDashboardAuth(env);

  // All routes require auth
  router.use('/api/dashboard/security', dashboardAuth);

  // POST /api/dashboard/security/audit/full
  router.post('/api/dashboard/security/audit/full', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({
        workspaceId: req.body?.workspaceId || 'default',
        userId: req.body?.userId || req.headers['x-user-id'] || 'system',
        type: 'full_security_audit',
        severity: 'info'
      });
      // Run all audits
      const secretResults = sec.secretSurfaceScanner.scanSecretSurfaces('full', services);
      const envResults = sec.envDriftDetector.detectEnvDrift(services);
      const permResults = sec.permissionAuditor.buildPermissionAuditReport([
        ...sec.permissionAuditor.auditOwnerAdminPermissions(services),
        ...sec.permissionAuditor.auditDashboardAccessPolicy(services)
      ]);
      const capResults = sec.capabilityRiskAuditor.buildCapabilityRiskReport([
        ...sec.capabilityRiskAuditor.auditDangerousCapabilities(services),
        ...sec.capabilityRiskAuditor.auditExternalWriteCapabilities(services)
      ]);
      const bypassResults = sec.approvalBypassAuditor.buildApprovalBypassReport(
        sec.approvalBypassAuditor.auditApprovalBypassPaths(services)
      );
      const redTeamResults = sec.redteamSimulator.runRedTeamSuite('full', services);

      const scorecard = sec.securityScorecard.calculateSecurityScorecard({
        secretResults, envResults, permissionResults: permResults,
        capabilityResults: capResults, approvalResults: bypassResults, redTeamResults
      });

      sec.securityAuditStore.completeAuditRun(audit.id, {
        findingsCount: secretResults.length + permResults.findings.length + capResults.findings.length,
        criticalFindingsCount: secretResults.filter(f => f.severity === 'critical').length + envResults.filter(e => e.severity === 'critical').length
      });

      return guards.safeDashboardResponse(res, {
        ok: true, auditId: audit.id, scorecard,
        secret: { total: secretResults.length },
        env: { total: envResults.length },
        permission: { total: permResults.findings.length },
        capability: { total: capResults.findings.length },
        bypass: { total: bypassResults.totalPaths, allBlocked: bypassResults.allBlocked },
        redTeam: { total: redTeamResults.total, passed: redTeamResults.passed, score: redTeamResults.score }
      });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/secret-scan
  router.post('/api/dashboard/security/secret-scan', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({
        workspaceId: req.body?.workspaceId || 'default', userId: 'system',
        type: 'secret_scan', severity: 'info'
      });
      const findings = sec.secretSurfaceScanner.scanSecretSurfaces('scan', services);
      const classified = findings.map(f => sec.secretFindingClassifier.classifySecretFinding(f)).filter(Boolean);
      sec.securityAuditStore.completeAuditRun(audit.id, { findingsCount: classified.length, criticalFindingsCount: classified.filter(f => f.severity === 'critical').length });
      return guards.safeDashboardResponse(res, {
        ok: true, auditId: audit.id,
        totalFindings: classified.length,
        criticalFindings: classified.filter(f => f.severity === 'critical').length,
        findings: classified.map(f => ({ id: f.id, surface: f.surface, secretType: f.secretType, severity: f.severity, redactedSample: '[REDACTED]', status: f.status }))
      });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // GET /api/dashboard/security/findings
  router.get('/api/dashboard/security/findings', async (req, res) => {
    try {
      const sec = require('../security');
      const { severity, status, surface, limit } = req.query;
      const findings = sec.secretFindingClassifier.listFindings({ severity, status, surface, limit: parseInt(limit) || 50 });
      const stats = sec.secretFindingClassifier.getFindingsStats();
      return guards.safeDashboardResponse(res, { ok: true, findings: findings.map(f => ({ id: f.id, surface: f.surface, secretType: f.secretType, severity: f.severity, redactedSample: '[REDACTED]', status: f.status, createdAt: f.createdAt })), stats });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/findings/:id/rotation-plan
  router.post('/api/dashboard/security/findings/:id/rotation-plan', async (req, res) => {
    try {
      const sec = require('../security');
      const finding = sec.secretFindingClassifier.getFinding(req.params.id);
      if (!finding) return guards.safeDashboardResponse(res, { ok: false, error: 'Finding not found' }, 404);
      let plan;
      if (finding.secretType.includes('TELEGRAM_TOKEN')) plan = sec.credentialRotationPlanner.createTelegramTokenRotationPlan([finding]);
      else if (finding.secretType.includes('GITHUB_TOKEN')) plan = sec.credentialRotationPlanner.createGithubTokenRotationPlan([finding]);
      else if (finding.secretType.includes('DATABASE_URL') || finding.secretType.includes('POSTGRESQL')) plan = sec.credentialRotationPlanner.createDatabaseUrlRotationPlan([finding]);
      else if (finding.secretType.includes('RENDER')) plan = sec.credentialRotationPlanner.createRenderKeyRotationPlan([finding]);
      else if (finding.secretType.includes('GOOGLE')) plan = sec.credentialRotationPlanner.createGoogleCredentialRotationPlan([finding]);
      else if (finding.secretType.includes('CLOUDFLARE')) plan = sec.credentialRotationPlanner.createCloudflareTokenRotationPlan([finding]);
      else plan = sec.credentialRotationPlanner.createCredentialRotationPlan([finding.id], { credentialType: finding.secretType, affectedSystems: ['Unknown'], riskLevel: finding.severity });
      sec.secretFindingClassifier.updateFindingStatus(finding.id, 'rotation_planned');
      const checklist = sec.credentialRotationPlanner.buildRotationChecklist(plan);
      return guards.safeDashboardResponse(res, { ok: true, planId: plan.id, credentialType: plan.credentialType, riskLevel: plan.riskLevel, manualSteps: plan.manualSteps, verificationSteps: plan.verificationSteps, rollbackConsiderations: plan.rollbackConsiderations });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // GET /api/dashboard/security/rotation-plans
  router.get('/api/dashboard/security/rotation-plans', async (req, res) => {
    try {
      const sec = require('../security');
      const { status, limit } = req.query;
      const plans = sec.credentialRotationPlanner.listRotationPlans({ status, limit: parseInt(limit) || 50 });
      const stats = sec.credentialRotationPlanner.getRotationPlanStats();
      return guards.safeDashboardResponse(res, { ok: true, plans: plans.map(p => ({ id: p.id, credentialType: p.credentialType, riskLevel: p.riskLevel, status: p.status, createdAt: p.createdAt })), stats });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/env-drift
  router.post('/api/dashboard/security/env-drift', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({ workspaceId: 'default', userId: 'system', type: 'env_drift', severity: 'info' });
      const drift = sec.envDriftDetector.detectEnvDrift(services);
      const report = sec.envDriftDetector.buildEnvDriftReport(drift);
      sec.securityAuditStore.completeAuditRun(audit.id, { findingsCount: drift.length, criticalFindingsCount: report.totalCritical });
      return guards.safeDashboardResponse(res, { ok: true, auditId: audit.id, ...report });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/permission-audit
  router.post('/api/dashboard/security/permission-audit', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({ workspaceId: 'default', userId: 'system', type: 'permission_audit', severity: 'info' });
      const findings = [
        ...sec.permissionAuditor.auditOwnerAdminPermissions(services),
        ...sec.permissionAuditor.auditWorkspacePermissions(services),
        ...sec.permissionAuditor.auditTelegramGroupSafety(services),
        ...sec.permissionAuditor.auditDashboardAccessPolicy(services),
        ...sec.permissionAuditor.auditExecutorApprovalRights(services),
        ...sec.permissionAuditor.auditLifeOSPrivacyAccess(services)
      ];
      const report = sec.permissionAuditor.buildPermissionAuditReport(findings);
      sec.securityAuditStore.completeAuditRun(audit.id, { findingsCount: findings.length, criticalFindingsCount: report.totalCritical });
      return guards.safeDashboardResponse(res, { ok: true, auditId: audit.id, ...report });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/capability-audit
  router.post('/api/dashboard/security/capability-audit', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({ workspaceId: 'default', userId: 'system', type: 'capability_audit', severity: 'info' });
      const govServices = { ...services, governance: { capabilityRegistry: services.governance || require('../governance') } };
      const findings = [
        ...sec.capabilityRiskAuditor.auditDangerousCapabilities(govServices),
        ...sec.capabilityRiskAuditor.auditExternalWriteCapabilities(govServices),
        ...sec.capabilityRiskAuditor.auditDisabledCapabilities(govServices),
        ...sec.capabilityRiskAuditor.auditCapabilityContracts(govServices),
        ...sec.capabilityRiskAuditor.detectCapabilityPolicyMismatch(govServices)
      ];
      const report = sec.capabilityRiskAuditor.buildCapabilityRiskReport(findings);
      sec.securityAuditStore.completeAuditRun(audit.id, { findingsCount: findings.length });
      return guards.safeDashboardResponse(res, { ok: true, auditId: audit.id, ...report });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/bypass-audit
  router.post('/api/dashboard/security/bypass-audit', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({ workspaceId: 'default', userId: 'system', type: 'approval_bypass_audit', severity: 'info' });
      const findings = sec.approvalBypassAuditor.auditApprovalBypassPaths(services);
      const report = sec.approvalBypassAuditor.buildApprovalBypassReport(findings);
      sec.securityAuditStore.completeAuditRun(audit.id, { findingsCount: findings.length });
      return guards.safeDashboardResponse(res, { ok: true, auditId: audit.id, ...report });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/redteam
  router.post('/api/dashboard/security/redteam', async (req, res) => {
    try {
      const sec = require('../security');
      const audit = sec.securityAuditStore.createAuditRun({ workspaceId: 'default', userId: 'system', type: 'redteam_audit', severity: 'info' });
      const results = sec.redteamSimulator.runRedTeamSuite('full', services);
      const report = sec.redteamSimulator.buildRedTeamReport(results);
      sec.securityAuditStore.completeAuditRun(audit.id, { findingsCount: results.total });
      return guards.safeDashboardResponse(res, { ok: true, auditId: audit.id, ...report });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/prompt-injection-test
  router.post('/api/dashboard/security/prompt-injection-test', async (req, res) => {
    try {
      const sec = require('../security');
      const cases = req.body?.cases || sec.promptInjectionTester.INJECTION_PATTERNS.map(p => ({ input: p.label }));
      const results = sec.promptInjectionTester.testPromptInjectionAgainstRouter(cases);
      return guards.safeDashboardResponse(res, { ok: true, ...results });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // GET /api/dashboard/security/scorecard
  router.get('/api/dashboard/security/scorecard', async (req, res) => {
    try {
      const sec = require('../security');
      const scorecard = sec.securityScorecard.calculateSecurityScorecard({});
      return guards.safeDashboardResponse(res, { ok: true, scorecard });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // GET /api/dashboard/security/report
  router.get('/api/dashboard/security/report', async (req, res) => {
    try {
      const sec = require('../security');
      const report = sec.securityReportGenerator.generateFullSecurityReport(req.query.workspaceId || 'default', services);
      return guards.safeDashboardResponse(res, { ok: true, report });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // POST /api/dashboard/security/proposal
  router.post('/api/dashboard/security/proposal', async (req, res) => {
    try {
      const sec = require('../security');
      const plan = sec.securityProposalBridge.createSecurityRepairPlan(req.body);
      const proposal = sec.securityProposalBridge.createSecurityExecutorProposal(plan);
      return guards.safeDashboardResponse(res, { ok: true, planId: plan.id, proposalId: proposal.id, status: proposal.status, message: 'Security proposal created. Requires Evaluation v2 + approval before execution.' });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });

  // GET /api/dashboard/security/audits
  router.get('/api/dashboard/security/audits', async (req, res) => {
    try {
      const sec = require('../security');
      const audits = sec.securityAuditStore.listAuditRuns({ type: req.query.type, status: req.query.status, limit: parseInt(req.query.limit) || 20 });
      const stats = sec.securityAuditStore.getAuditStats();
      return guards.safeDashboardResponse(res, { ok: true, audits, stats });
    } catch (e) {
      return guards.safeDashboardResponse(res, { ok: false, error: e.message }, 500);
    }
  });
}

module.exports = { registerSecurityRoutes };
