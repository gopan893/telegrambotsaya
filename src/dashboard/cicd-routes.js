'use strict';

const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');

function registerCicdRoutes(router, services = {}) {
  const cicd = services.cicdSystem;
  if (!cicd) return;

  async function ensureAccess(req, res) {
    if (!guards.validateDashboardAccess(req)) {
      return guards.safeDashboardResponse(res, { ok: false, error: 'UNAUTHORIZED' }, 401);
    }
    return true;
  }

  router.get('/cicd/status', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const releases = await cicd.store.getReleases();
    const proposals = await cicd.store.getProposals();
    const pipelines = await cicd.store.getPipelines();
    return guards.safeDashboardResponse(res, {
      ok: true,
      initialized: true,
      releaseCount: releases.length,
      proposalCount: proposals.length,
      pipelineCount: pipelines.length,
      lastRelease: releases.length > 0 ? releases[releases.length - 1] : null
    });
  });

  router.get('/cicd/releases', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const releases = await cicd.store.getReleases();
    return guards.safeDashboardResponse(res, { ok: true, releases: releases.slice(-50).reverse() });
  });

  router.get('/cicd/proposals', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const proposals = await cicd.store.getProposals();
    return guards.safeDashboardResponse(res, { ok: true, proposals: proposals.slice(-50).reverse() });
  });

  router.get('/cicd/pipelines', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const pipelines = await cicd.store.getPipelines();
    return guards.safeDashboardResponse(res, { ok: true, pipelines: pipelines.slice(-50).reverse() });
  });

  router.post('/cicd/quality-check', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const ctx = { evaluationScore: Number(req.body?.evaluationScore) || 100 };
    const result = await cicd.qualityGate.runQualityChecks(ctx);
    return guards.safeDashboardResponse(res, { ok: result.ok, ...result });
  });

  router.post('/cicd/propose-release', async (req, res) => {
    if (!await ensureAccess(req, res)) return;
    const { version } = req.body || {};
    if (!version) return guards.safeDashboardResponse(res, { ok: false, error: 'version required' }, 400);
    const ctx = { evaluationScore: Number(req.body?.evaluationScore) || 100 };
    const checks = await cicd.qualityGate.runQualityChecks(ctx);
    if (!checks.ok) return guards.safeDashboardResponse(res, { ok: false, error: 'Quality checks failed', checks });
    const result = await cicd.proposal.proposeRelease(version, checks, { workspaceId: req.body?.workspaceId || '' });
    return guards.safeDashboardResponse(res, result);
  });
}

module.exports = { registerCicdRoutes };
