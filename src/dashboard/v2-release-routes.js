'use strict';

const express = require('express');
const rcManager = require('../v2-release/v2-release-candidate-manager');
const readinessGate = require('../v2-release/v2-readiness-gate');
const regressionRunner = require('../v2-release/v2-regression-suite-runner');
const compatChecker = require('../v2-release/v2-compatibility-checker');
const changelogGen = require('../v2-release/v2-changelog-generator');
const upgradeGen = require('../v2-release/v2-upgrade-guide-generator');
const rollbackGen = require('../v2-release/v2-rollback-plan-generator');
const notesGen = require('../v2-release/v2-release-notes-generator');
const proposalBridge = require('../v2-release/v2-release-proposal-bridge');
const releaseReport = require('../v2-release/v2-release-report-generator');

function registerV2ReleaseRoutes(router, services = {}) {
  router.get('/v2-release', async (req, res) => {
    try {
      const candidates = rcManager.listReleaseCandidates ? rcManager.listReleaseCandidates() : [];
      const latest = candidates.length ? candidates[candidates.length - 1] : null;
      res.json({ ok: true, status: 'ready', data: { candidates, latest } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/v2-release/create', async (req, res) => {
    try {
      const candidate = await rcManager.createV2ReleaseCandidate(req.body, services);
      res.json({ ok: true, status: 'ready', data: candidate });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id', async (req, res) => {
    try {
      const candidate = await rcManager.getV2ReleaseCandidateStatus(req.params.id, services);
      res.json({ ok: true, status: 'ready', data: candidate });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/v2-release/:id/readiness', async (req, res) => {
    try {
      const result = await readinessGate.runV2ReadinessGate(req.params.id, services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/v2-release/:id/regression-suite', async (req, res) => {
    try {
      const result = await regressionRunner.runV2RegressionSuite(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id/compatibility', async (req, res) => {
    try {
      const report = await compatChecker.buildV2CompatibilityReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id/changelog', async (req, res) => {
    try {
      const changelog = await changelogGen.buildHumanReadableV2Changelog(services);
      res.json({ ok: true, status: 'ready', data: changelog });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id/upgrade-guide', async (req, res) => {
    try {
      const guide = await upgradeGen.generateV2UpgradeGuide(services);
      res.json({ ok: true, status: 'ready', data: guide });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id/rollback-plan', async (req, res) => {
    try {
      const plan = await rollbackGen.generateV2RollbackPlan(services);
      res.json({ ok: true, status: 'ready', data: plan });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id/notes', async (req, res) => {
    try {
      const notes = await notesGen.generateV2ReleaseNotes(req.params.id, services);
      res.json({ ok: true, status: 'ready', data: notes });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/v2-release/:id/proposal', async (req, res) => {
    try {
      const proposal = await proposalBridge.createV2ReleaseActionPlan(req.params.id, services);
      res.json({ ok: true, status: 'ready', data: proposal });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-release/:id/report', async (req, res) => {
    try {
      const report = await releaseReport.generateV2ReleaseReport(req.params.id, services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerV2ReleaseRoutes };
