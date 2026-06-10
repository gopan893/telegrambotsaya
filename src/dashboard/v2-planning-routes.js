'use strict';

const express = require('express');
const v2Gate = require('../v2-planning/v2-planning-gate');
const v2Scope = require('../v2-planning/v2-scope-manager');
const v2Principles = require('../v2-planning/v2-architecture-principles');
const v2Migration = require('../v2-planning/v2-migration-planner');
const v2Risk = require('../v2-planning/v2-risk-register');
const v2Criteria = require('../v2-planning/v2-acceptance-criteria');
const v2Decision = require('../v2-planning/v2-decision-log');
const v2Report = require('../v2-planning/v2-planning-report-generator');

function registerV2PlanningRoutes(router, services = {}) {
  router.get('/v2-planning', async (req, res) => {
    try {
      const report = await v2Report.generateV2PlanningReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/v2-planning/run-gate', async (req, res) => {
    try {
      const result = await v2Gate.runV2PlanningGate(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/scope', async (req, res) => {
    try {
      const scope = await v2Scope.defineV2Scope(services);
      const report = await v2Scope.buildV2ScopeReport(scope, services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/principles', async (req, res) => {
    try {
      const report = await v2Principles.buildPrinciplesReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/migration-plan', async (req, res) => {
    try {
      const plan = await v2Migration.createV2MigrationPlan(services);
      res.json({ ok: true, status: 'ready', data: plan });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/risk-register', async (req, res) => {
    try {
      const report = await v2Risk.buildV2RiskReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/acceptance-criteria', async (req, res) => {
    try {
      const criteria = await v2Criteria.defineV2AcceptanceCriteria(services);
      res.json({ ok: true, status: 'ready', data: criteria });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/v2-planning/record-decision', async (req, res) => {
    try {
      const decision = await v2Decision.recordV2Decision(req.body, services);
      res.json({ ok: true, status: 'ready', data: decision });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/decisions', async (req, res) => {
    try {
      const decisions = await v2Decision.listV2Decisions(req.query, services);
      res.json({ ok: true, status: 'ready', data: decisions });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/v2-planning/report', async (req, res) => {
    try {
      const report = await v2Report.generateV2PlanningReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerV2PlanningRoutes };
