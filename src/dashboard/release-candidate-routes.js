'use strict';

const express = require('express');
const guards = require('./dashboard-guards');
const release = require('../release');

function registerReleaseCandidateRoutes(router, services = {}) {
  const env = services.env || process.env || {};

  router.get('/release-candidate', (req, res) => {
    const store = release.getStore();
    const candidates = release.listReleaseCandidates();
    const latest = release.getLatestReleaseCandidate();
    const freeze = release.getReleaseFreezeStatus(services);

    return guards.safeDashboardResponse(res, {
      ok: true,
      candidates: candidates.map(sanitizeCandidate),
      latest: latest ? sanitizeCandidate(latest) : null,
      count: candidates.length,
      freezeStatus: freeze
    });
  });

  router.post('/release-candidate/create', (req, res) => {
    const input = {
      workspaceId: req.body.workspaceId || 'default',
      version: req.body.version || release.DEFAULT_VERSION,
      title: req.body.title || 'Stable AI OS v1 Release Candidate',
      branch: req.body.branch || 'main',
      commitSha: req.body.commitSha || ''
    };

    const candidate = release.createReleaseCandidate(input, services);
    return guards.safeDashboardResponse(res, {
      ok: true,
      candidate: sanitizeCandidate(candidate)
    });
  });

  router.get('/release-candidate/:id', (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }
    return guards.safeDashboardResponse(res, { ok: true, candidate: sanitizeCandidate(candidate) });
  });

  router.post('/release-candidate/:id/run-readiness', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const readiness = await release.checkAllModuleReadiness(services);
    const report = release.buildModuleReadinessReport(readiness);

    release.updateReleaseCandidate(req.params.id, {
      moduleReadinessStatus: report.summary,
      blockers: candidate.blockers || []
    });

    if (!report.summary.allReady) {
      for (const blocked of report.summary.blockedModules) {
        release.addBlocker(req.params.id, 'Module blocked: ' + blocked);
      }
    }

    return guards.safeDashboardResponse(res, {
      ok: true,
      moduleReadiness: {
        summary: report.summary,
        details: report.details,
        missingAdapters: report.missingAdapters,
        brokenImports: report.brokenImports,
        duplicates: report.duplicates
      }
    });
  });

  router.post('/release-candidate/:id/run-compatibility', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const compat = await release.verifyPhaseCompatibility(services);

    release.updateReleaseCandidate(req.params.id, {
      dashboardStatus: { tabCount: compat.results.dashboardCompat.tabCount, score: compat.results.dashboardCompat.score },
      telegramStatus: { score: compat.results.telegramCommandCompat.score }
    });

    return guards.safeDashboardResponse(res, {
      ok: true,
      compatibility: {
        averageScore: compat.averageScore,
        scores: compat.scores,
        compatible: compat.compatible,
        issues: compat.allIssues
      }
    });
  });

  router.post('/release-candidate/:id/risk-review', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const riskReview = await release.reviewReleaseRisks(req.params.id, services);

    if (riskReview.summary.hasCriticalBlockers) {
      for (const risk of riskReview.summary.critical) {
        release.addBlocker(req.params.id, 'Critical risk: ' + risk.description);
      }
    }

    return guards.safeDashboardResponse(res, {
      ok: true,
      riskSummary: riskReview.summary,
      risks: {
        security: riskReview.boot,
        privacy: riskReview.dashboard,
        deploy: riskReview.telegram,
        operational: riskReview.executor
      }
    });
  });

  router.post('/release-candidate/:id/run-production-gate', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const gate = await release.runProductionReadinessGate(services);

    release.updateReleaseCandidate(req.params.id, {
      productionReadinessStatus: gate,
      releaseGateStatus: {
        gatesPassed: gate.releaseGatesPassed,
        score: gate.averageScore,
        blockedBy: gate.blockedBy
      }
    });

    for (const b of gate.blockedBy) {
      release.addBlocker(req.params.id, 'Production blocker: ' + b);
    }

    return guards.safeDashboardResponse(res, {
      ok: true,
      productionReadiness: {
        allReady: gate.allReady,
        averageScore: gate.averageScore,
        scores: gate.scores,
        releaseGatesPassed: gate.releaseGatesPassed,
        blockers: gate.blockers,
        blockedBy: gate.blockedBy,
        results: gate.results
      }
    });
  });

  router.get('/release-candidate/:id/notes', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const notes = await release.generateReleaseNotes(req.params.id, services);
    return guards.safeDashboardResponse(res, { ok: true, notes });
  });

  router.get('/release-candidate/:id/changelog', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const changelog = await release.generateChangelogSinceLastRelease(services);
    return guards.safeDashboardResponse(res, { ok: true, changelog });
  });

  router.get('/release-candidate/:id/env-checklist', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const checklist = await release.generateFinalEnvironmentChecklist(services);
    return guards.safeDashboardResponse(res, { ok: true, checklist });
  });

  router.get('/release-candidate/:id/operator-guide', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const guides = {
      admin: await release.generateAdminOperationGuide(services),
      telegram: await release.generateTelegramCommandGuide(services),
      dashboard: await release.generateDashboardGuide(services),
      approval: await release.generateApprovalFlowGuide(services),
      incident: await release.generateIncidentResponseGuide(services),
      backup: await release.generateBackupRecoveryGuide(services),
      security: await release.generateSecurityPrivacyGuide(services)
    };

    return guards.safeDashboardResponse(res, { ok: true, guides });
  });

  router.get('/release-candidate/:id/report', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const report = {
      candidate: sanitizeCandidate(candidate),
      readiness: candidate.moduleReadinessStatus,
      productionGate: candidate.productionReadinessStatus,
      compatibility: {
        score: candidate.dashboardStatus ? candidate.dashboardStatus.score : null,
        telegramScore: candidate.telegramStatus ? candidate.telegramStatus.score : null
      },
      blockers: candidate.blockers,
      warnings: candidate.warnings,
      timestamp: new Date().toISOString()
    };

    return guards.safeDashboardResponse(res, { ok: true, report });
  });

  router.post('/release-candidate/:id/proposal', async (req, res) => {
    const candidate = release.getReleaseCandidate(req.params.id);
    if (!candidate) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'Release candidate not found' }, 404);
    }

    const proposalType = req.body.type || 'action_plan';
    let result;

    switch (proposalType) {
      case 'action_plan':
        result = await release.createReleaseActionPlan(req.params.id, services);
        break;
      case 'github_tag':
        result = await release.createGitHubTagProposal(req.params.id, services);
        break;
      case 'github_release':
        result = await release.createGitHubReleaseProposal(req.params.id, services);
        break;
      case 'deploy':
        result = await release.createDeployReleaseProposal(req.params.id, services);
        break;
      default:
        return guards.safeDashboardResponse(res, { ok: false, error: 'Unknown proposal type: ' + proposalType }, 400);
    }

    return guards.safeDashboardResponse(res, {
      ok: result.ok,
      type: proposalType,
      proposal: result.proposal || result.plan,
      note: result.ok ? 'Proposal created. No external action executed. Requires Evaluation v2 + executor approval.' : result.error
    });
  });

  router.post('/release-candidate/start-freeze', (req, res) => {
    const freeze = release.startReleaseFreeze({
      startedBy: req.body.startedBy || 'dashboard_admin',
      reason: req.body.reason || 'Phase 50 Release Candidate preparation'
    }, services);

    return guards.safeDashboardResponse(res, freeze);
  });

  router.post('/release-candidate/end-freeze', (req, res) => {
    const result = release.endReleaseFreeze(services);
    return guards.safeDashboardResponse(res, result);
  });

  router.get('/release-candidate/freeze-status', (req, res) => {
    const status = release.getReleaseFreezeStatus(services);
    return guards.safeDashboardResponse(res, status);
  });
}

function sanitizeCandidate(c) {
  if (!c) return null;
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    version: c.version,
    title: c.title,
    status: c.status,
    branch: c.branch,
    commitSha: c.commitSha ? (c.commitSha.length > 12 ? c.commitSha.slice(0, 12) + '...' : c.commitSha) : '',
    moduleReadinessStatus: c.moduleReadinessStatus,
    productionReadinessStatus: c.productionReadinessStatus,
    securityStatus: c.securityStatus,
    privacyStatus: c.privacyStatus,
    dashboardStatus: c.dashboardStatus,
    telegramStatus: c.telegramStatus,
    executorStatus: c.executorStatus,
    deployStatus: c.deployStatus,
    releaseGateStatus: c.releaseGateStatus,
    blockers: (c.blockers || []).map(b => typeof b === 'string' ? b : (b.message || JSON.stringify(b))),
    warnings: (c.warnings || []).map(w => typeof w === 'string' ? w : (w.message || JSON.stringify(w))),
    reportId: c.reportId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

module.exports = { registerReleaseCandidateRoutes };
