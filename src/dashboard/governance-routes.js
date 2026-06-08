'use strict';

const express = require('express');
const auth = require('./dashboard-auth');
const governance = require('../governance');

function registerGovernanceRoutes(app, services) {
  const router = express.Router();
  const env = (services && services.env) || process.env;

  router.use(auth.requireDashboardAuth);

  function safeError(res, err, label) {
    console.error(`[governance-routes] ${label}:`, err.message);
    return res.status(500).json({ ok: false, error: 'Internal error', label });
  }

  router.get('/governance', (req, res) => {
    try {
      const status = governance.getGovernanceStatus();
      return res.json({ ok: true, data: status });
    } catch (err) {
      return safeError(res, err, 'GET /governance');
    }
  });

  router.get('/governance/capabilities', (req, res) => {
    try {
      const filters = {};
      if (req.query.module) filters.module = req.query.module;
      if (req.query.actionType) filters.actionType = req.query.actionType;
      if (req.query.riskLevel) filters.riskLevel = req.query.riskLevel;
      if (req.query.enabled !== undefined) filters.enabled = req.query.enabled === 'true';

      const capabilities = governance.capabilityRegistry.listCapabilities(filters);
      const sanitized = capabilities.map(c => ({
        id: c.id,
        module: c.module,
        name: c.name,
        description: c.description,
        actionType: c.actionType,
        riskLevel: c.riskLevel,
        externalSystem: c.externalSystem,
        requiresOwner: c.requiresOwner,
        requiresAdmin: c.requiresAdmin,
        requiresEvaluation: c.requiresEvaluation,
        requiresExecutorApproval: c.requiresExecutorApproval,
        requiresSecretScan: c.requiresSecretScan,
        requiresCostGuard: c.requiresCostGuard,
        enabled: c.enabled
      }));
      return res.json({ ok: true, data: sanitized, total: sanitized.length });
    } catch (err) {
      return safeError(res, err, 'GET /governance/capabilities');
    }
  });

  router.get('/governance/capabilities/:id', (req, res) => {
    try {
      const cap = governance.capabilityRegistry.getCapability(req.params.id);
      if (!cap) return res.status(404).json({ ok: false, error: 'Capability not found' });
      const contract = governance.capabilityContracts.getContractForCapability(cap.id);
      return res.json({ ok: true, data: { ...cap, contract } });
    } catch (err) {
      return safeError(res, err, 'GET /governance/capabilities/:id');
    }
  });

  router.post('/governance/simulate', (req, res) => {
    try {
      const { action, actor, context } = req.body || {};
      const actorId = 'dashboard_user';
      const actorObj = { id: actorId, userId: actorId };

      const simulation = governance.actionPolicySimulator.simulateActionPolicy(
        action || 'unknown',
        actor || actorObj,
        context || {}
      );

      const report = governance.actionPolicySimulator.buildPolicySimulationReport(simulation);
      return res.json({ ok: true, data: simulation, report });
    } catch (err) {
      return safeError(res, err, 'POST /governance/simulate');
    }
  });

  router.post('/governance/secret-scan', (req, res) => {
    try {
      const { payload } = req.body || {};
      if (!payload) return res.status(400).json({ ok: false, error: 'Payload required' });

      const scan = governance.unifiedSecretGuard.scanGovernancePayloadForSecrets(payload);
      const report = governance.unifiedSecretGuard.buildSecretGuardReport({ blocked: false, reason: null, scan });
      const redacted = governance.unifiedSecretGuard.redactGovernancePayload(payload);

      return res.json({
        ok: true,
        data: {
          hasSecret: scan.hasSecret,
          matches: scan.matches.map(m => ({ label: m.label })),
          safe: !scan.hasSecret,
          redacted
        },
        report
      });
    } catch (err) {
      return safeError(res, err, 'POST /governance/secret-scan');
    }
  });

  router.get('/governance/policies', (req, res) => {
    try {
      const policy = governance.governancePolicyStore.getGovernancePolicy();
      const rules = governance.governancePolicyStore.getGovernanceRules();
      const contracts = governance.capabilityContracts.getAllContracts().map(c => ({
        capabilityId: c.capabilityId,
        module: c.module,
        actionType: c.actionType,
        riskLevel: c.riskLevel,
        enabled: c.enabled,
        requires: c.requires,
        restrictions: c.restrictions
      }));

      return res.json({
        ok: true,
        data: {
          governancePolicy: policy,
          rules,
          contracts,
          approvalFlow: governance.governancePolicyStore.getApprovalFlow()
        }
      });
    } catch (err) {
      return safeError(res, err, 'GET /governance/policies');
    }
  });

  router.get('/governance/audit', (req, res) => {
    try {
      const filters = {};
      if (req.query.module) filters.module = req.query.module;
      if (req.query.riskLevel) filters.riskLevel = req.query.riskLevel;
      if (req.query.decision) filters.decision = req.query.decision;
      if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);

      const events = governance.governanceAudit.listGovernanceAudit(filters);
      const sanitized = events.map(e => governance.governanceAudit.sanitizeGovernanceAudit(e));
      const summary = governance.governanceAudit.summarizeGovernanceAudit(filters);

      return res.json({ ok: true, data: sanitized, summary });
    } catch (err) {
      return safeError(res, err, 'GET /governance/audit');
    }
  });

  router.get('/governance/blocked', (req, res) => {
    try {
      const allDecisions = governance.governanceDecisionEngine.getRecentDecisions(100);
      const blocked = allDecisions.filter(d => d.blocked);
      const sanitized = blocked.map(d => ({
        id: d.id,
        actionId: d.actionId,
        riskLevel: d.riskLevel,
        reasons: d.reasons,
        timestamp: d.timestamp
      }));
      return res.json({ ok: true, data: sanitized, total: sanitized.length });
    } catch (err) {
      return safeError(res, err, 'GET /governance/blocked');
    }
  });

  router.post('/governance/validate', (req, res) => {
    try {
      const { action, actor, context } = req.body || {};
      const actorObj = { id: 'dashboard_user', userId: 'dashboard_user' };

      const decision = governance.governanceDecisionEngine.evaluateGovernanceAction(
        action || 'unknown',
        actor || actorObj,
        context || {}
      );

      const explanation = governance.governanceDecisionEngine.explainGovernanceDecision(decision);
      governance.governanceAudit.recordGovernanceDecision(decision);

      return res.json({
        ok: true,
        data: {
          id: decision.id,
          actionId: decision.actionId,
          allowed: decision.allowed,
          blocked: decision.blocked,
          proposalRequired: decision.proposalRequired,
          evaluationRequired: decision.evaluationRequired,
          executorApprovalRequired: decision.executorApprovalRequired,
          ownerApprovalRequired: decision.ownerApprovalRequired,
          riskLevel: decision.riskLevel,
          outcome: decision.outcome,
          reasons: decision.reasons
        },
        explanation
      });
    } catch (err) {
      return safeError(res, err, 'POST /governance/validate');
    }
  });

  app.use('/api/dashboard', router);
}

module.exports = { registerGovernanceRoutes };
