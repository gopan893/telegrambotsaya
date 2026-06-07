'use strict';

const crypto = require('crypto');
const dashboardGuards = require('../dashboard/dashboard-guards');
const workspace = require('../workspace');

const RISK_ORDER = ['low', 'medium', 'high', 'critical'];
const PRIORITY_MODES = ['balanced', 'speed', 'stability', 'cost_saving', 'quality', 'manual'];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'portfolio') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function sanitize(value) {
  return dashboardGuards.preventSecretLeak(value);
}

function compactText(value = '', max = 280) {
  const clean = sanitize(String(value || '').replace(/\s+/g, ' ').trim());
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function containsSecretLike(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  const masked = dashboardGuards.preventSecretLeak(raw);
  return masked !== raw || dashboardGuards.SECRET_PATTERNS.some(pattern => pattern.test(raw));
}

function normalizeWorkspaceId(userId = '', workspaceId = '') {
  const clean = String(workspaceId || '').trim();
  if (clean) return clean;
  try {
    return workspace.utils.getPersonalWorkspaceId(String(userId || 'dashboard'));
  } catch (_) {
    return 'default';
  }
}

async function resolveWorkspaceId(userId = '', workspaceId = '', services = {}) {
  const clean = String(workspaceId || '').trim();
  if (clean) return clean;
  try {
    const item = await workspace.store.getDefaultWorkspaceForUser(String(userId || 'dashboard'), services);
    return item?.id || normalizeWorkspaceId(userId, workspaceId);
  } catch (_) {
    return normalizeWorkspaceId(userId, workspaceId);
  }
}

function normalizePriorityMode(value = 'balanced') {
  const clean = String(value || 'balanced').toLowerCase();
  return PRIORITY_MODES.includes(clean) ? clean : 'balanced';
}

function normalizeStatus(value = 'active') {
  const clean = String(value || 'active').toLowerCase();
  return ['active', 'paused', 'reviewing', 'archived'].includes(clean) ? clean : 'active';
}

function normalizeRisk(value = 'low') {
  const clean = String(value || 'low').toLowerCase();
  if (clean === 'danger') return 'critical';
  return RISK_ORDER.includes(clean) ? clean : 'low';
}

function maxRisk(values = []) {
  let max = 'low';
  for (const value of values) {
    const risk = normalizeRisk(value);
    if (RISK_ORDER.indexOf(risk) > RISK_ORDER.indexOf(max)) max = risk;
  }
  return max;
}

function daysSince(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(item => item !== null && typeof item !== 'undefined');
  if (value === null || typeof value === 'undefined' || value === '') return [];
  return [value];
}

function uniqueList(value, limit = 80) {
  const seen = new Set();
  const out = [];
  for (const item of asArray(value)) {
    const clean = compactText(item, 160);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function getItemWorkspaceId(item = {}, fallback = '') {
  return item.workspaceId || item.workspace_id || item.metadata?.workspaceId || fallback || '';
}

function getItemUserId(item = {}, fallback = '') {
  return String(item.userId || item.user_id || item.ownerId || item.createdBy || fallback || '');
}

function isActiveStatus(status = '') {
  const clean = String(status || '').toLowerCase();
  return !clean || ['active', 'todo', 'doing', 'draft', 'reviewing', 'pending', 'pending_approval', 'blocked'].includes(clean);
}

function itemMatchesWorkspace(item = {}, workspaceId = '') {
  const itemWorkspaceId = getItemWorkspaceId(item);
  return !workspaceId || !itemWorkspaceId || String(itemWorkspaceId) === String(workspaceId);
}

function stableSortByUpdated(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice()
    .sort((a, b) => String(b.updatedAt || b.lastSeenAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.lastSeenAt || a.createdAt || '')));
}

function summarizeGoal(goal = {}) {
  return sanitize({
    id: goal.id,
    workspaceId: getItemWorkspaceId(goal),
    userId: getItemUserId(goal),
    title: compactText(goal.title || goal.name || goal.label || 'Untitled project', 140),
    description: compactText(goal.description || goal.summary || '', 260),
    status: goal.status || 'active',
    priority: goal.priority || 'medium',
    progress: Number(goal.progress || goal.progressPercent || goal.completion || 0),
    updatedAt: goal.updatedAt || goal.lastSeenAt || goal.createdAt || '',
    createdAt: goal.createdAt || ''
  });
}

function summarizeTask(task = {}) {
  return sanitize({
    id: task.id,
    workspaceId: getItemWorkspaceId(task),
    userId: getItemUserId(task),
    planId: task.planId || '',
    linkedGoalId: task.linkedGoalId || task.goalId || '',
    title: compactText(task.title || task.name || 'Untitled task', 150),
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    priorityScore: Number(task.priorityScore || 0),
    dependencies: uniqueList(task.dependencies || [], 20),
    dueDate: task.dueDate || null,
    blockedReason: compactText(task.blockedReason || task.reason || '', 220),
    updatedAt: task.updatedAt || task.createdAt || ''
  });
}

async function auditPortfolio(action, payload = {}, services = {}) {
  try {
    const auditLog = require('../dashboard/audit-log');
    await auditLog.recordAuditLog({
      actorType: payload.actorType || 'portfolio',
      actorId: payload.actorId || services.actorId || payload.userId || 'portfolio',
      action,
      targetType: payload.targetType || 'portfolio',
      targetId: payload.targetId || payload.id || payload.workspaceId || '',
      userId: payload.userId || services.userId || '',
      workspaceId: payload.workspaceId || services.workspaceId || '',
      actorRole: payload.actorRole || '',
      permission: payload.permission || 'read',
      decision: payload.decision || 'allowed',
      status: payload.status || 'ok',
      beforeSummary: payload.beforeSummary || '',
      afterSummary: sanitize(payload.afterSummary || payload.summary || {}),
      reason: payload.reason || ''
    }, services);
  } catch (_) {}
}

module.exports = {
  PRIORITY_MODES,
  asArray,
  auditPortfolio,
  clampScore,
  compactText,
  containsSecretLike,
  createId,
  daysSince,
  getItemUserId,
  getItemWorkspaceId,
  isActiveStatus,
  itemMatchesWorkspace,
  maxRisk,
  normalizePriorityMode,
  normalizeRisk,
  normalizeStatus,
  normalizeWorkspaceId,
  nowIso,
  resolveWorkspaceId,
  sanitize,
  stableSortByUpdated,
  summarizeGoal,
  summarizeTask,
  uniqueList
};
