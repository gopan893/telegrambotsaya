'use strict';

const { nowIso, generateId, generateSnapshotId } = require('./operating-loop-utils');

const loops = new Map();
const runs = new Map();
const snapshots = new Map();

const DEFAULT_BLOCKED_ACTIONS = [
  'write', 'external', 'danger', 'shell', 'git_push',
  'deploy', 'rollback', 'email_send', 'calendar_write', 'webhook_post'
];

const DEFAULT_READ_ACTIONS = [
  'read', 'list', 'view', 'search', 'summarize',
  'export', 'analyze', 'audit', 'monitor', 'inspect', 'review'
];

const STORAGE_KEY_LOOPS = 'operating-loop:loops';
const STORAGE_KEY_RUNS = 'operating-loop:runs';
const STORAGE_KEY_SNAPSHOTS = 'operating-loop:snapshots';

function buildDefaultLoop(id, name, description, cadence) {
  return {
    id,
    name,
    description,
    mode: 'scheduled_readonly',
    status: 'enabled',
    cadence,
    allowedReadOnlyActions: [...DEFAULT_READ_ACTIONS],
    blockedActions: [...DEFAULT_BLOCKED_ACTIONS],
    requiresEvaluation: true,
    requiresApprovalForProposals: true,
    quietHours: { start: '22:00', end: '07:00' },
    maxNotificationsPerDay: 3,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function getDefaultLoopsData() {
  return [
    buildDefaultLoop('daily_ai_os_briefing', 'Daily AI OS Briefing', 'Daily briefing of AI OS operations and status.', 'daily'),
    buildDefaultLoop('project_operator_review', 'Project Operator Review', 'Review project operator status and task progress.', 'daily'),
    buildDefaultLoop('portfolio_priority_review', 'Portfolio Priority Review', 'Review portfolio priorities and project health.', 'weekly'),
    buildDefaultLoop('production_health_review', 'Production Health Review', 'Monitor production health metrics and incidents.', 'hourly'),
    buildDefaultLoop('incident_review', 'Incident Review', 'Review open incidents and response status.', 'daily'),
    buildDefaultLoop('cost_budget_review', 'Cost & Budget Review', 'Review cost tracking and budget status.', 'weekly'),
    buildDefaultLoop('pending_approval_review', 'Pending Approval Review', 'Review pending executor proposals awaiting approval.', 'daily'),
    buildDefaultLoop('knowledge_memory_review', 'Knowledge & Memory Review', 'Review knowledge graph health and memory status.', 'weekly'),
    buildDefaultLoop('lifeos_daily_review', 'LifeOS Daily Review', 'Review LifeOS daily plan, habits, and goals.', 'daily'),
    buildDefaultLoop('weekly_strategy_review', 'Weekly Strategy Review', 'Review weekly strategy and long-term goals.', 'weekly')
  ];
}

async function loadFromStorage(services) {
  const sm = services.storageManager;
  if (!sm || !sm.loadData) return;
  try {
    const storedLoops = await sm.loadData(STORAGE_KEY_LOOPS, null);
    if (storedLoops && typeof storedLoops === 'object') {
      for (const [id, def] of Object.entries(storedLoops)) {
        loops.set(id, def);
      }
    }
    const storedRuns = await sm.loadData(STORAGE_KEY_RUNS, null);
    if (storedRuns && typeof storedRuns === 'object') {
      for (const [id, run] of Object.entries(storedRuns)) {
        runs.set(id, run);
      }
    }
    const storedSnapshots = await sm.loadData(STORAGE_KEY_SNAPSHOTS, null);
    if (storedSnapshots && typeof storedSnapshots === 'object') {
      for (const [id, snap] of Object.entries(storedSnapshots)) {
        snapshots.set(id, snap);
      }
    }
  } catch (err) {
    console.error('[operating-loop-store] loadFromStorage error:', err.message);
  }
}

async function persistToStorage(services) {
  const sm = services.storageManager;
  if (!sm || !sm.saveData) return;
  try {
    const loopsObj = Object.fromEntries(loops);
    await sm.saveData(STORAGE_KEY_LOOPS, loopsObj);
    const runsObj = Object.fromEntries(runs);
    await sm.saveData(STORAGE_KEY_RUNS, runsObj);
    const snapshotsObj = Object.fromEntries(snapshots);
    await sm.saveData(STORAGE_KEY_SNAPSHOTS, snapshotsObj);
  } catch (err) {
    console.error('[operating-loop-store] persistToStorage error:', err.message);
  }
}

function applyFilters(items, filters) {
  if (!filters || typeof filters !== 'object') return Array.from(items.values());
  const entries = Array.from(items.values());
  return entries.filter(item => {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;
      if (key === 'q' || key === 'query') {
        const q = String(value).toLowerCase();
        const haystack = Object.values(item).map(v => String(v || '')).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
        continue;
      }
      const itemVal = item[key];
      if (Array.isArray(itemVal) && !Array.isArray(value)) {
        if (!itemVal.includes(value)) return false;
        continue;
      }
      if (itemVal !== value) return false;
    }
    return true;
  });
}

async function listOperatingLoops(filters, services) {
  if (services === undefined) services = {};
  if (filters === undefined) filters = {};
  try {
    await loadFromStorage(services);
    if (loops.size === 0) {
      const defaults = getDefaultLoopsData();
      for (const def of defaults) {
        loops.set(def.id, def);
      }
      await persistToStorage(services);
    }
    const results = applyFilters(loops, filters);
    return { ok: true, data: results, total: results.length };
  } catch (err) {
    console.error('[operating-loop-store] listOperatingLoops error:', err.message);
    return { ok: false, error: err.message, data: [], total: 0 };
  }
}

async function getOperatingLoop(loopId, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    if (loops.size === 0) {
      const defaults = getDefaultLoopsData();
      for (const def of defaults) {
        loops.set(def.id, def);
      }
      await persistToStorage(services);
    }
    const loop = loops.get(loopId) || null;
    if (!loop) return { ok: false, error: 'LOOP_NOT_FOUND', data: null };
    return { ok: true, data: loop };
  } catch (err) {
    console.error('[operating-loop-store] getOperatingLoop error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function saveOperatingLoop(loopDef, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    const now = nowIso();
    if (loops.has(loopDef.id)) {
      const existing = loops.get(loopDef.id);
      const updated = { ...existing, ...loopDef, updatedAt: now };
      loops.set(loopDef.id, updated);
      await persistToStorage(services);
      return { ok: true, data: updated };
    }
    const entry = { ...loopDef, createdAt: loopDef.createdAt || now, updatedAt: now };
    loops.set(entry.id, entry);
    await persistToStorage(services);
    return { ok: true, data: entry };
  } catch (err) {
    console.error('[operating-loop-store] saveOperatingLoop error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function removeOperatingLoop(loopId, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    const removed = loops.get(loopId);
    if (!removed) return { ok: false, error: 'LOOP_NOT_FOUND' };
    loops.delete(loopId);
    await persistToStorage(services);
    return { ok: true, data: removed };
  } catch (err) {
    console.error('[operating-loop-store] removeOperatingLoop error:', err.message);
    return { ok: false, error: err.message };
  }
}

async function listLoopRuns(filters, services) {
  if (services === undefined) services = {};
  if (filters === undefined) filters = {};
  try {
    await loadFromStorage(services);
    const results = applyFilters(runs, filters);
    return { ok: true, data: results, total: results.length };
  } catch (err) {
    console.error('[operating-loop-store] listLoopRuns error:', err.message);
    return { ok: false, error: err.message, data: [], total: 0 };
  }
}

async function getLoopRun(runId, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    const run = runs.get(runId) || null;
    if (!run) return { ok: false, error: 'RUN_NOT_FOUND', data: null };
    return { ok: true, data: run };
  } catch (err) {
    console.error('[operating-loop-store] getLoopRun error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function saveLoopRun(runData, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    const now = nowIso();
    if (runs.has(runData.id)) {
      const existing = runs.get(runData.id);
      const updated = { ...existing, ...runData, updatedAt: now };
      runs.set(runData.id, updated);
      await persistToStorage(services);
      return { ok: true, data: updated };
    }
    const entry = { ...runData, id: runData.id || generateId(), createdAt: runData.createdAt || now, updatedAt: now };
    runs.set(entry.id, entry);
    await persistToStorage(services);
    return { ok: true, data: entry };
  } catch (err) {
    console.error('[operating-loop-store] saveLoopRun error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function listSnapshots(filters, services) {
  if (services === undefined) services = {};
  if (filters === undefined) filters = {};
  try {
    await loadFromStorage(services);
    const results = applyFilters(snapshots, filters);
    return { ok: true, data: results, total: results.length };
  } catch (err) {
    console.error('[operating-loop-store] listSnapshots error:', err.message);
    return { ok: false, error: err.message, data: [], total: 0 };
  }
}

async function getSnapshot(snapshotId, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    const snap = snapshots.get(snapshotId) || null;
    if (!snap) return { ok: false, error: 'SNAPSHOT_NOT_FOUND', data: null };
    return { ok: true, data: snap };
  } catch (err) {
    console.error('[operating-loop-store] getSnapshot error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function saveSnapshot(snapshot, services) {
  if (services === undefined) services = {};
  try {
    await loadFromStorage(services);
    const now = nowIso();
    if (snapshots.has(snapshot.id)) {
      const existing = snapshots.get(snapshot.id);
      const updated = { ...existing, ...snapshot, updatedAt: now };
      snapshots.set(snapshot.id, updated);
      await persistToStorage(services);
      return { ok: true, data: updated };
    }
    const entry = { ...snapshot, id: snapshot.id || generateSnapshotId(), createdAt: snapshot.createdAt || now, updatedAt: now };
    snapshots.set(entry.id, entry);
    await persistToStorage(services);
    return { ok: true, data: entry };
  } catch (err) {
    console.error('[operating-loop-store] saveSnapshot error:', err.message);
    return { ok: false, error: err.message, data: null };
  }
}

async function getDefaultLoops(services) {
  if (services === undefined) services = {};
  return { ok: true, data: getDefaultLoopsData() };
}

module.exports = {
  listOperatingLoops,
  getOperatingLoop,
  saveOperatingLoop,
  removeOperatingLoop,
  listLoopRuns,
  getLoopRun,
  saveLoopRun,
  listSnapshots,
  getSnapshot,
  saveSnapshot,
  getDefaultLoops
};
