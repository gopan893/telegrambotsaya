'use strict';

const store = require('./operating-loop-store');
const registry = require('./operating-loop-registry');
const collector = require('./system-state-collector');
const snapshotBuilder = require('./operating-snapshot-builder');
const blockerDetector = require('./blocker-detector');
const synthesizer = require('./next-action-synthesizer');
const policy = require('./operating-loop-policy');
const costGuard = require('./operating-loop-cost-guard');
const evalGate = require('./operating-loop-evaluation-gate');
const proposalBridge = require('./operating-loop-proposal-bridge');
const notifier = require('./operating-loop-notifier');
const reports = require('./operating-loop-report-generator');
const utils = require('./operating-loop-utils');

const RUN_TIMEOUT_MS = 30 * 1000;
const MAX_ACTIONS = 5;
const MAX_NOTIFICATIONS_KEY = 'operating_loop_notifications_today';

const loopRuns = new Map();

function nowIso() {
  return typeof utils.nowIso === 'function' ? utils.nowIso() : new Date().toISOString();
}

function generateRunId(loopId) {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 6);
  return `run_${loopId || 'unknown'}_${ts}_${rnd}`;
}

function isQuietHours(services = {}) {
  const quietStart = services.quietHoursStart || 22;
  const quietEnd = services.quietHoursEnd || 7;
  const hour = new Date().getHours();
  if (quietStart <= quietEnd) {
    return hour >= quietStart && hour < quietEnd;
  }
  return hour >= quietStart || hour < quietEnd;
}

async function withTimeout(promise, label, timeoutMs = RUN_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Phase timed out: ${label} (${timeoutMs}ms)`));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function createLoopRun(loopId, loop) {
  const run = {
    id: generateRunId(loopId),
    loopId,
    status: 'started',
    startedAt: nowIso(),
    completedAt: null,
    phases: {
      collect_state: { status: 'pending', error: null },
      build_snapshot: { status: 'pending', error: null },
      detect_blockers: { status: 'pending', error: null },
      synthesize_actions: { status: 'pending', error: null },
      policy_check: { status: 'pending', error: null },
      cost_guard: { status: 'pending', error: null },
      evaluation_gate_if_needed: { status: 'pending', error: null },
      create_proposal_if_needed: { status: 'pending', error: null },
      notify_user: { status: 'pending', error: null },
      record_audit: { status: 'pending', error: null }
    },
    state: null,
    snapshot: null,
    blockers: [],
    actions: [],
    blockedActions: [],
    proposals: [],
    notifications: [],
    result: null,
    error: null
  };
  loopRuns.set(run.id, run);
  return run;
}

async function runOperatingLoop(loopId, services = {}) {
  const loop = registry.getLoop ? registry.getLoop(loopId, services) : null;
  if (!loop) {
    return { blocked: true, reason: 'loop_not_found', loopId };
  }

  if (loop.enabled === false) {
    return { blocked: true, reason: 'disabled', loopId, loopConfig: loop };
  }

  if (isQuietHours(services) && loop.runDuringQuietHours !== true) {
    return { blocked: true, reason: 'quiet_hours', loopId, loopConfig: loop };
  }

  const run = createLoopRun(loopId, loop);

  try {
    await withTimeout(executePhases(run, loop, services), 'runOperatingLoop');
    run.status = 'completed';
    run.completedAt = nowIso();
    run.result = await buildLoopRunResult(run, services);
  } catch (err) {
    run.status = 'failed';
    run.completedAt = nowIso();
    run.error = err.message;
    run.result = await buildLoopRunResult(run, services);
  }

  if (store.updateLoopRun) {
    try {
      store.updateLoopRun(run.id, run, services);
      run.phases.record_audit.status = 'completed';
    } catch (err) {
      run.phases.record_audit.status = 'failed';
      run.phases.record_audit.error = err.message;
    }
  }

  return run.result;
}

async function executePhases(run, loop, services) {
  const workspaceId = loop.workspaceId || services.workspaceId || 'default';

  run.phases.collect_state.status = 'running';
  try {
    run.state = await collector.collectSystemState(workspaceId, services);
    run.phases.collect_state.status = 'completed';
  } catch (err) {
    run.phases.collect_state.status = 'failed';
    run.phases.collect_state.error = err.message;
    throw err;
  }

  run.phases.build_snapshot.status = 'running';
  try {
    run.snapshot = await snapshotBuilder.buildOperatingSnapshot(run.state, services);
    run.phases.build_snapshot.status = 'completed';
  } catch (err) {
    run.phases.build_snapshot.status = 'failed';
    run.phases.build_snapshot.error = err.message;
    throw err;
  }

  run.phases.detect_blockers.status = 'running';
  try {
    run.blockers = await blockerDetector.detectOperatingBlockers(run.state, run.snapshot, services);
    run.phases.detect_blockers.status = 'completed';
  } catch (err) {
    run.phases.detect_blockers.status = 'failed';
    run.phases.detect_blockers.error = err.message;
    throw err;
  }

  const hasCriticalBlocker = run.blockers.some(b =>
    b.severity === 'critical' || b.critical === true || b.blocked === true
  );

  if (!hasCriticalBlocker) {
    run.phases.synthesize_actions.status = 'running';
    try {
      const allActions = await synthesizer.synthesizeNextActions(run.snapshot, run.blockers, services);
      run.actions = (allActions || []).slice(0, MAX_ACTIONS);
      run.phases.synthesize_actions.status = 'completed';
    } catch (err) {
      run.phases.synthesize_actions.status = 'failed';
      run.phases.synthesize_actions.error = err.message;
    }
  } else {
    run.phases.synthesize_actions.status = 'skipped';
    run.phases.synthesize_actions.error = 'Critical blocker detected; actions not synthesized';
  }

  run.phases.policy_check.status = 'running';
  const filteredActions = [];
  try {
    for (const action of run.actions) {
      const evaluation = policy.evaluateLoopPolicy ? policy.evaluateLoopPolicy(action, run.snapshot, services) : { allowed: true };
      if (evaluation.blocked) {
        run.blockedActions.push({ action, reason: evaluation.reason || 'policy_blocked' });
      } else {
        filteredActions.push({ action, policyResult: evaluation });
      }
    }
    run.actions = filteredActions;
    run.phases.policy_check.status = 'completed';
  } catch (err) {
    run.phases.policy_check.status = 'failed';
    run.phases.policy_check.error = err.message;
  }

  run.phases.cost_guard.status = 'running';
  try {
    const budgetResult = await costGuard.runOperatingLoopBudgetGuard(run.actions, run.snapshot, services);
    if (budgetResult?.budgetExceeded) {
      run.actions = run.actions.filter(a => {
        if (a.action?.expensive || a.expensive) {
          run.blockedActions.push({ action: a, reason: 'budget_exceeded' });
          return false;
        }
        return true;
      });
    }
    run.phases.cost_guard.status = 'completed';
  } catch (err) {
    run.phases.cost_guard.status = 'failed';
    run.phases.cost_guard.error = err.message;
  }

  run.phases.evaluation_gate_if_needed.status = 'running';
  const proposals = [];
  try {
    for (const entry of run.actions) {
      const action = entry.action || entry;
      const policyResult = entry.policyResult || {};
      if (policyResult.requiresEvaluation || action.requiresEvaluation) {
        const gateResult = await evalGate.runOperatingEvaluationGate(action, run.snapshot, services);
        if (!gateResult?.ok) {
          run.blockedActions.push({ action, reason: 'evaluation_gate_failed' });
          continue;
        }
        proposals.push({ action, gateResult });
      } else {
        proposals.push({ action });
      }
    }
    run.phases.evaluation_gate_if_needed.status = 'completed';
  } catch (err) {
    run.phases.evaluation_gate_if_needed.status = 'failed';
    run.phases.evaluation_gate_if_needed.error = err.message;
  }

  run.phases.create_proposal_if_needed.status = 'running';
  const createdProposals = [];
  try {
    for (const entry of proposals) {
      const action = entry.action;
      const policyResult = entry.policyResult || {};
      if (policyResult.proposalOnly || action.proposalOnly) {
        const proposal = await proposalBridge.createOperatingLoopProposal(action, run.snapshot, services);
        if (proposal?.ok) {
          createdProposals.push(proposal.proposal || proposal);
        } else {
          run.blockedActions.push({ action, reason: 'proposal_creation_failed' });
        }
      }
    }
    run.proposals = createdProposals;
    run.phases.create_proposal_if_needed.status = 'completed';
  } catch (err) {
    run.phases.create_proposal_if_needed.status = 'failed';
    run.phases.create_proposal_if_needed.error = err.message;
  }

  run.phases.notify_user.status = 'running';
  try {
    const notifKey = `loop_${loopId}_daily`;
    const isDuplicate = await notifier.suppressDuplicateLoopNotification(notifKey, services);
    if (!isDuplicate) {
      const isWeekly = loop.type === 'weekly' || loop.cycle === 'weekly';
      const briefing = isWeekly
        ? await notifier.buildWeeklyOperatingBriefing(run.snapshot, run.actions.map(e => e.action || e), run.blockers, services)
        : await notifier.buildDailyOperatingBriefing(run.snapshot, run.actions.map(e => e.action || e), run.blockers, services);
      const sent = await notifier.sendOperatingLoopNotification(briefing, services);
      run.notifications.push({ text: briefing, sent, at: nowIso() });
    }
    run.phases.notify_user.status = 'completed';
  } catch (err) {
    run.phases.notify_user.status = 'failed';
    run.phases.notify_user.error = err.message;
  }
}

async function runManualOperatingLoop(loopId, services = {}) {
  return runOperatingLoop(loopId, { ...services, manual: true });
}

async function runDailyOperatingCycle(workspaceId, services = {}) {
  const loop = registry.getLoop ? registry.getLoop('daily_ai_os_briefing', services) : null;

  if (!loop || loop.enabled === false) {
    return { skipped: true, reason: 'disabled', loopId: 'daily_ai_os_briefing' };
  }

  return runOperatingLoop(loop.id || 'daily_ai_os_briefing', { ...services, workspaceId });
}

async function runWeeklyOperatingCycle(workspaceId, services = {}) {
  const loop = registry.getLoop ? registry.getLoop('weekly_strategy_review', services) : null;

  if (!loop || loop.enabled === false) {
    return { skipped: true, reason: 'disabled', loopId: 'weekly_strategy_review' };
  }

  return runOperatingLoop(loop.id || 'weekly_strategy_review', { ...services, workspaceId, cycle: 'weekly' });
}

async function stopOperatingLoop(loopId, services = {}) {
  for (const [runId, run] of loopRuns.entries()) {
    if (run.loopId === loopId && run.status === 'started') {
      run.status = 'stopped';
      run.completedAt = nowIso();
      run.error = 'Manually stopped';
      if (store.updateLoopRun) {
        try {
          store.updateLoopRun(runId, run, services);
        } catch (_) {}
      }
      return { ok: true, stopped: true, runId };
    }
  }
  return { ok: false, stopped: false, reason: 'no_running_loop_found' };
}

async function buildLoopRunResult(run, services = {}) {
  if (!run) {
    return {
      id: null,
      loopId: null,
      status: 'error',
      error: 'No run data',
      startedAt: null,
      completedAt: null,
      summary: '',
      totalActions: 0,
      totalBlockers: 0,
      blockedActions: [],
      proposals: [],
      notifications: [],
      phases: {}
    };
  }

  const totalActions = (run.actions || []).length;
  const totalBlocked = (run.blockedActions || []).length;

  let summary = `Run ${run.status}: ${totalActions} action(s), ${totalBlocked} blocked`;
  if (run.error) summary += `, error: ${run.error}`;

  return {
    id: run.id,
    loopId: run.loopId,
    status: run.status,
    error: run.error || null,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    summary,
    totalActions,
    totalBlockers: (run.blockers || []).length,
    blockedActions: (run.blockedActions || []).map(ba => ({
      action: ba.action?.action || ba.action?.description || 'unknown',
      reason: ba.reason || 'unknown'
    })),
    proposals: (run.proposals || []).map(p => ({
      id: p.id || p.proposalId || 'unknown',
      title: p.title || p.description || ''
    })),
    notifications: (run.notifications || []).length,
    phases: Object.fromEntries(
      Object.entries(run.phases || {}).map(([name, info]) => [name, { status: info.status, error: info.error }])
    )
  };
}

async function getLoopStatus(loopId, services = {}) {
  const loop = registry.getLoop ? registry.getLoop(loopId, services) : null;
  if (!loop) {
    return { id: loopId, status: 'not_found', lastRun: null, healthSummary: null, loopConfig: null };
  }

  const runs = Array.from(loopRuns.values())
    .filter(r => r.loopId === loopId)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  const lastRun = runs[0] || null;

  const recentRuns = runs.slice(0, 10);
  const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
  const completedRuns = recentRuns.filter(r => r.status === 'completed').length;

  let healthSummary = 'unknown';
  if (loop.enabled === false) {
    healthSummary = 'disabled';
  } else if (failedRuns > completedRuns && recentRuns.length > 0) {
    healthSummary = 'degraded';
  } else if (completedRuns > 0) {
    healthSummary = 'healthy';
  }

  return {
    id: loopId,
    status: loop.enabled === false ? 'disabled' : 'active',
    lastRun: lastRun ? {
      id: lastRun.id,
      status: lastRun.status,
      startedAt: lastRun.startedAt,
      completedAt: lastRun.completedAt,
      summary: lastRun.result?.summary || ''
    } : null,
    healthSummary,
    loopConfig: {
      id: loop.id,
      name: loop.name,
      type: loop.type,
      cycle: loop.cycle,
      enabled: loop.enabled,
      workspaceId: loop.workspaceId
    }
  };
}

module.exports = {
  runOperatingLoop,
  runManualOperatingLoop,
  runDailyOperatingCycle,
  runWeeklyOperatingCycle,
  stopOperatingLoop,
  buildLoopRunResult,
  getLoopStatus
};
