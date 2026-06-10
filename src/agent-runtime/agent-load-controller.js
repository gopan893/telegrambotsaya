'use strict';

const store = require('./agent-runtime-store');
const utils = require('./agent-runtime-utils');

const PRIORITY_LEVELS = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

const CATEGORY_PRIORITY_MAP = {
  security_incident: 'P0',
  privacy_incident: 'P0',
  incident_response: 'P0',
  deploy: 'P1',
  release: 'P1',
  critical_fix: 'P1',
  coding: 'P2',
  research: 'P2',
  evaluation: 'P2',
  planning: 'P2',
  routine: 'P3',
  lifeos: 'P3',
  docs: 'P3',
  low_priority: 'P4',
  greeting: 'P4'
};

function classifyPriority(task = {}, services = {}) {
  const text = String(task.input || task.description || '').toLowerCase();
  const type = String(task.type || task.class || '').toLowerCase();
  if (/security|incident|privacy.*breach|data.*leak|urgent.*fix/i.test(text) || /security_incident|privacy_incident|incident_response/.test(type)) return 'P0';
  if (/deploy|release|hotfix|critical.*bug/i.test(text) || /deploy|release|critical_fix/.test(type)) return 'P1';
  if (/code|coding|debug|research|analys|evaluate|plan|strategi/i.test(text) || /coding|research|evaluation|planning/.test(type)) return 'P2';
  if (/routine|lifeos|mood|habit|daily|weekly|docs|dokumentasi/i.test(text) || /routine|lifeos|docs/.test(type)) return 'P3';
  if (/low|minor|nice.to.have|cosmetic/i.test(text) || /low_priority|greeting/.test(type)) return 'P4';
  return 'P3';
}

function classifyDomain(task = {}, services = {}) {
  const text = String(task.input || task.description || '').toLowerCase();
  const type = String(task.type || '').toLowerCase();
  if (/security|vulnerability|audit|threat/i.test(text)) return 'security';
  if (/privacy|data.*protect|gdpr|retention/i.test(text)) return 'privacy';
  if (/code|coding|implement|debug|fix|refactor|test/i.test(text) || /coding/.test(type)) return 'coding';
  if (/research|analys|compare|investigate/i.test(text) || /research/.test(type)) return 'research';
  if (/deploy|release|ci.?cd|pipeline/i.test(text)) return 'ops';
  if (/lifeos|mood|energy|habit|personal/i.test(text)) return 'lifeos';
  if (/plan|strategi|roadmap|decision/i.test(text)) return 'planning';
  return 'general';
}

function assessLoad(tasks = [], services = {}) {
  const active = tasks.filter(t => t.status === 'running' || t.status === 'queued');
  const byPriority = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 };
  for (const t of active) {
    const p = classifyPriority(t, services);
    byPriority[p]++;
  }
  const totalActive = active.length;
  const capacity = services.maxConcurrentTasks || 10;
  const loadPercent = Math.min(100, Math.round((totalActive / capacity) * 100));
  const overloaded = loadPercent > 80;
  const criticalOverload = byPriority.P0 > 0 && totalActive >= capacity;
  return {
    totalActive,
    capacity,
    loadPercent,
    overloaded,
    criticalOverload,
    byPriority,
    headroom: Math.max(0, capacity - totalActive),
    recordedAt: new Date().toISOString()
  };
}

async function shouldAcceptTask(task = {}, tasks = [], services = {}) {
  const load = assessLoad(tasks, services);
  const priority = classifyPriority(task, services);
  const priorityNum = PRIORITY_LEVELS[priority] ?? 4;
  if (load.criticalOverload && priorityNum > 0) {
    return { accepted: false, reason: 'critical_overload', priority, load };
  }
  if (load.overloaded && priorityNum > 2) {
    return { accepted: false, reason: 'overloaded', priority, load };
  }
  if (load.headroom === 0 && priorityNum > 1) {
    return { accepted: false, reason: 'capacity_full', priority, load };
  }
  return { accepted: true, priority, load };
}

function buildLoadSnapshot(tasks = [], services = {}) {
  const snapshot = assessLoad(tasks, services);
  return { id: utils.createId('load'), ...snapshot };
}

async function recordLoadSnapshot(tasks = [], services = {}) {
  const snapshot = buildLoadSnapshot(tasks, services);
  return store.addRecord('loadSnapshots', snapshot, services);
}

module.exports = {
  classifyPriority,
  classifyDomain,
  assessLoad,
  shouldAcceptTask,
  buildLoadSnapshot,
  recordLoadSnapshot,
  PRIORITY_LEVELS,
  CATEGORY_PRIORITY_MAP
};
