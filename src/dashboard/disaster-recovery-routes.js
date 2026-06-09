'use strict';

const dr = require('../disaster-recovery');

function registerDisasterRecoveryRoutes(router, services = {}) {
  const svc = { ...services, env: process.env };

  router.get('/disaster-recovery', (req, res) => {
    try {
      res.json({ ok: true, status: 'Disaster Recovery routes active', endpoints: ['drills', 'recovery-plan', 'restore-rehearsal', 'backup-integrity', 'encryption', 'readiness', 'proposal', 'report'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/drills', async (req, res) => {
    try {
      const drill = dr.drDrillManager.createDisasterRecoveryDrill(req.body, svc);
      res.json(drill);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/disaster-recovery/drills', async (req, res) => {
    try {
      const drills = dr.drStore.listDrills(req.query);
      res.json({ ok: true, drills });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/disaster-recovery/drills/:id', async (req, res) => {
    try {
      const drill = dr.drStore.getDrill(req.params.id);
      if (!drill) return res.status(404).json({ ok: false, error: 'Drill not found' });
      const summary = dr.drDrillManager.summarizeDisasterRecoveryDrill(req.params.id, svc);
      res.json({ ok: true, drill, summary });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/drills/:id/dry-run', async (req, res) => {
    try {
      const result = await dr.drDrillManager.runDisasterRecoveryDrillDryRun(req.params.id, svc);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/recovery-plan', async (req, res) => {
    try {
      const plan = await dr.recoveryPlanGenerator.generateRecoveryPlan(req.body?.scope || 'full', svc);
      res.json({ ok: true, plan });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/restore-rehearsal', async (req, res) => {
    try {
      const result = await dr.restoreRehearsalRunner.runRestoreRehearsal(req.body?.scope || 'dashboard', svc);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/disaster-recovery/backup-integrity', async (req, res) => {
    try {
      const integrity = await dr.backupIntegrityChecker.buildBackupIntegrityReport({}, svc);
      res.json({ ok: true, integrity });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/disaster-recovery/encryption-policy', async (req, res) => {
    try {
      const policy = dr.backupEncryptionPolicy.getBackupEncryptionPolicy(svc);
      const report = dr.backupEncryptionPolicy.buildBackupEncryptionPolicyReport(svc);
      res.json({ ok: true, policy, report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/encryption-plan', async (req, res) => {
    try {
      const plan = dr.backupEncryptionPlanner.createBackupEncryptionPlan(req.body?.scope || 'full', svc);
      res.json({ ok: true, plan });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/secret-rotation-rehearsal', async (req, res) => {
    try {
      const result = await dr.secretRotationRehearsal.createSecretRotationRehearsal(req.body?.secretType || 'telegram', svc);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/disaster-recovery/readiness', async (req, res) => {
    try {
      const gate = await dr.recoveryReadinessGate.runRecoveryReadinessGate(svc);
      res.json({ ok: true, gate });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/disaster-recovery/proposal', async (req, res) => {
    try {
      const proposal = dr.drProposalBridge.createDisasterRecoveryActionPlan(req.body, svc);
      const executorProposal = dr.drProposalBridge.createDisasterRecoveryExecutorProposal(proposal, svc);
      res.json({ ok: true, plan: proposal, proposal: executorProposal });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/disaster-recovery/report', async (req, res) => {
    try {
      const report = await dr.drReportGenerator.generateDrReport(svc);
      res.json({ ok: true, report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerDisasterRecoveryRoutes };
