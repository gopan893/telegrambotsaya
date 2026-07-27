'use strict';

const utils = require('./routine-utils');
const policy = require('./routine-policy');

function createRoutineRunner(services = {}) {
  const auditLog = services.auditLog || [];
  const activeRuns = new Set();
  const policyGuard = policy.createRoutinePolicy(services);
  const registry = services.registry || null;
  const proposalBridge = services.proposalBridge || null;

  function getStore() {
    return registry?.routineStore || null;
  }

  function isRunning(routineId) {
    return activeRuns.has(routineId);
  }

  async function runRoutine(routineId, context = {}, svc = {}) {
    const store = getStore();
    if (!store) return { status: 'failed', error: 'Store not available' };
    if (activeRuns.has(routineId)) return { status: 'blocked', error: 'Routine already running' };

    const routine = store.getRoutine(routineId);
    if (!routine) return { status: 'failed', error: 'Routine not found' };
    if (!routine.enabled) return { status: 'blocked', error: 'Routine is disabled' };

    activeRuns.add(routineId);

    const run = store.createRun({
      routineId: routine.id,
      workspaceId: routine.workspaceId,
      userId: routine.userId || context.userId || 'system',
      mode: routine.mode
    });

    try {
      run.status = 'running';
      store.updateRun(run.id, { status: 'running' });
      auditLog.push({ type: 'routine_run_started', routineId: routine.id, runId: run.id, timestamp: utils.nowIso() });

      // Run the routine handler
      const handler = registry?.getHandler?.(routine.type) || null;

      let findings = [];
      let summary = '';
      let recommendations = [];
      let warnings = [];

      if (handler && typeof handler.execute === 'function') {
        const result = await handler.execute(routine, context, svc);
        findings = result.findings || [];
        summary = result.summary || '';
        recommendations = result.recommendations || [];
        warnings = result.warnings || [];

        // Filter out blocked actions
        findings = findings.filter(f => {
          const policyResult = policyGuard.checkRoutinePolicy(routine, f.action || '');
          if (!policyResult.allowed && policyResult.requiresProposal) {
            recommendations.push({
              type: 'create_proposal',
              action: f.action,
              reason: policyResult.reason,
              requiresEvaluation: policyResult.requiresEvaluation
            });
            return false;
          }
          return policyResult.allowed;
        });
      } else {
        summary = `Routine "${routine.name}" executed (no handler registered)`;
        findings = [{ type: 'info', message: 'Handler not registered for this routine type' }];
      }

      // Create proposals for recommendations if bridge available
      const proposalIds = [];
      for (const rec of recommendations) {
        if (rec.type === 'create_proposal' && proposalBridge) {
          const actionPlan = {
            action: rec.action,
            reason: rec.reason,
            requiresEvaluation: rec.requiresEvaluation
          };
          try {
            const propResult = proposalBridge.createRoutineActionPlan(run, actionPlan, svc);
            if (propResult.proposalId) {
              proposalIds.push(propResult.proposalId);
            }
          } catch (_) {}
        }
      }

      const completedAt = utils.nowIso();
      store.updateRun(run.id, {
        status: 'completed',
        completedAt,
        summary: utils.sanitizeOutput(summary),
        findings: findings.map(f => ({ ...f, message: utils.sanitizeOutput(f.message || '') })),
        recommendations: recommendations.map(r => ({ ...r, reason: utils.sanitizeOutput(r.reason || '') })),
        proposalIds,
        warnings
      });

      // Update routine's lastRunAt and nextRunAt
      store.updateRoutine(routine.id, {
        lastRunAt: completedAt,
        nextRunAt: utils.computeNextRun(routine.schedule)
      });

      auditLog.push({ type: 'routine_run_completed', routineId: routine.id, runId: run.id, timestamp: completedAt });

      return {
        status: 'completed',
        runId: run.id,
        summary,
        findings,
        recommendations,
        proposalIds,
        warnings
      };
    } catch (err) {
      const errorMsg = err.message || 'Unknown error';
      store.updateRun(run.id, { status: 'failed', completedAt: utils.nowIso(), errors: [errorMsg] });
      auditLog.push({ type: 'routine_run_failed', routineId: routine.id, runId: run.id, error: errorMsg, timestamp: utils.nowIso() });
      return { status: 'failed', error: utils.sanitizeOutput(errorMsg), runId: run.id };
    } finally {
      activeRuns.delete(routineId);
    }
  }

  async function runRoutineDryRun(routineId, svc = {}) {
    const store = getStore();
    if (!store) return { status: 'failed', error: 'Store not available' };

    const routine = store.getRoutine(routineId);
    if (!routine) return { status: 'failed', error: 'Routine not found' };

    // Dry-run creates a run but does NOT allow write actions
    const run = store.createRun({
      routineId: routine.id,
      workspaceId: routine.workspaceId,
      userId: 'system',
      mode: 'scheduled_dry_run'
    });

    try {
      run.status = 'running';
      store.updateRun(run.id, { status: 'running' });

      const handler = registry?.getHandler?.(routine.type) || null;
      let summary = '';
      let findings = [];

      if (handler && typeof handler.dryRun === 'function') {
        const result = await handler.dryRun(routine, {}, svc);
        summary = result.summary || '';
        findings = result.findings || [];
      } else {
        summary = `Dry-run of "${routine.name}" completed (no handler registered)`;
        findings = [{ type: 'info', message: 'Dry-run executed, no actions performed' }];
      }

      store.updateRun(run.id, {
        status: 'completed',
        completedAt: utils.nowIso(),
        summary: utils.sanitizeOutput(summary),
        findings: findings.map(f => ({ ...f, message: utils.sanitizeOutput(f.message || '') })),
        warnings: ['Dry-run mode - no write/external actions were performed']
      });

      auditLog.push({ type: 'routine_dry_run_executed', routineId: routine.id, runId: run.id, timestamp: utils.nowIso() });

      return { status: 'completed', runId: run.id, summary, findings };
    } catch (err) {
      const errorMsg = err.message || 'Unknown error';
      store.updateRun(run.id, { status: 'failed', completedAt: utils.nowIso(), errors: [errorMsg] });
      return { status: 'failed', error: errorMsg, runId: run.id };
    }
  }

  function buildRoutineRunSummary(run) {
    return {
      id: run.id,
      routineId: run.routineId,
      status: run.status,
      mode: run.mode,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      summary: utils.sanitizeOutput(run.summary || ''),
      findingsCount: (run.findings || []).length,
      recommendationsCount: (run.recommendations || []).length,
      proposalsCount: (run.proposalIds || []).length,
      warnings: run.warnings || [],
      errors: run.errors || []
    };
  }

  return {
    runRoutine,
    runRoutineDryRun,
    buildRoutineRunSummary,
    isRunning
  };
}

module.exports = { createRoutineRunner };
