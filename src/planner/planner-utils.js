'use strict';

const crypto = require('crypto');
const workspace = require('../workspace');
const dashboardGuards = require('../dashboard/dashboard-guards');

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'id') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function compactText(value = '', max = 240) {
  const clean = dashboardGuards.preventSecretLeak(String(value || '').replace(/\s+/g, ' ').trim());
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(item => item !== null && typeof item !== 'undefined');
  if (typeof value === 'undefined' || value === null || value === '') return [];
  return [value];
}

function uniqueList(value, limit = 50) {
  const seen = new Set();
  const out = [];
  for (const item of asArray(value)) {
    const clean = compactText(item, 120);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function parsePipeArgs(args = '') {
  return String(args || '')
    .split('|')
    .map(part => part.trim());
}

function normalizeWorkspaceId(userId, workspaceId = '') {
  const clean = String(workspaceId || '').trim();
  if (clean) return clean;
  return workspace.utils.getPersonalWorkspaceId(userId);
}

async function resolveWorkspaceId(userId, workspaceId, services = {}) {
  const cleanUserId = String(userId || '').trim();
  const requested = String(workspaceId || '').trim();
  if (requested) return requested;
  try {
    const item = await workspace.store.getDefaultWorkspaceForUser(cleanUserId, services);
    return item?.id || normalizeWorkspaceId(cleanUserId);
  } catch (_) {
    return normalizeWorkspaceId(cleanUserId);
  }
}

async function getActorRole(actorId, workspaceId, services = {}) {
  try {
    const summary = await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
    return summary?.role || 'none';
  } catch (_) {
    return 'none';
  }
}

function normalizeHorizon(value = 'weekly') {
  const clean = String(value || 'weekly').toLowerCase();
  return ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(clean) ? clean : 'weekly';
}

function normalizePlanStatus(value = 'draft') {
  const clean = String(value || 'draft').toLowerCase();
  return ['draft', 'active', 'paused', 'completed', 'archived'].includes(clean) ? clean : 'draft';
}

function normalizeTaskStatus(value = 'todo') {
  const clean = String(value || 'todo').toLowerCase();
  return ['todo', 'doing', 'blocked', 'done', 'archived'].includes(clean) ? clean : 'todo';
}

function normalizePriority(value = 'medium') {
  const clean = String(value || 'medium').toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(clean) ? clean : 'medium';
}

function normalizeEffort(value = 'medium') {
  const clean = String(value || 'medium').toLowerCase();
  return ['small', 'medium', 'large'].includes(clean) ? clean : 'medium';
}

function normalizeImpactUrgency(value = 'medium') {
  const clean = String(value || 'medium').toLowerCase();
  return ['low', 'medium', 'high'].includes(clean) ? clean : 'medium';
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function stableSortByUpdated(items = []) {
  return items
    .slice()
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

function summarizePlan(plan = {}) {
  return {
    id: plan.id,
    workspaceId: plan.workspaceId,
    title: compactText(plan.title, 120),
    status: plan.status,
    horizon: plan.horizon,
    tasks: Array.isArray(plan.taskIds) ? plan.taskIds.length : 0,
    milestones: Array.isArray(plan.milestones) ? plan.milestones.length : 0
  };
}

function summarizeTask(task = {}) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    planId: task.planId,
    title: compactText(task.title, 120),
    status: task.status,
    priority: task.priority,
    priorityScore: Number(task.priorityScore || 0)
  };
}

function isGreetingOrTinyText(text = '') {
  const clean = String(text || '').trim().toLowerCase();
  return /^(halo|hai|hi|hello|pagi|siang|sore|malam|ok|oke|sip|makasih|terima kasih|thanks)$/i.test(clean);
}

function isMathLike(text = '') {
  const clean = String(text || '').replace(/\s+/g, '');
  return /^[0-9+\-*/().,%]+$/.test(clean) && /\d/.test(clean);
}

function extractTaskCandidates(text = '') {
  const clean = String(text || '').replace(/\r/g, '\n').trim();
  if (!clean) return [];
  const lines = clean
    .split(/\n+/)
    .map(line => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(line => line.length >= 4);
  if (lines.length > 1) return lines.slice(0, 12);
  const parts = clean
    .split(/\b(?:lalu|kemudian|setelah itu|dan kemudian|,)\b/i)
    .map(part => part.trim())
    .filter(part => part.length >= 8);
  return (parts.length > 1 ? parts : [clean]).slice(0, 8);
}

function detectPlannerNaturalNeed(text = '', adaptiveResult = {}) {
  const clean = String(text || '').trim();
  const lower = clean.toLowerCase();
  if (!clean || clean.startsWith('/') || isGreetingOrTinyText(clean) || isMathLike(clean)) {
    return { shouldUse: false, reason: 'simple_or_command', confidence: 0 };
  }
  const keywords = [
    'prioritas',
    'langkah berikut',
    'next action',
    'roadmap',
    'rencana',
    'planner',
    'plan',
    'task',
    'tugas',
    'pecah goal',
    'pecah tujuan',
    'kerjakan minggu ini',
    'harus saya kerjakan',
    'lanjutkan workflow',
    'milestone',
    'progress',
    'blocked',
    'deadline'
  ];
  const matches = keywords.filter(keyword => lower.includes(keyword));
  const adaptiveHit = ['strategic', 'decision', 'cognitive-workspace'].includes(adaptiveResult?.mode);
  const confidence = Math.min(0.95, (matches.length * 0.22) + (adaptiveHit ? 0.2 : 0));
  return {
    shouldUse: matches.length > 0 || confidence >= 0.45,
    reason: matches.length ? `matched:${matches.slice(0, 3).join(',')}` : 'adaptive_context',
    confidence
  };
}

module.exports = {
  compactText,
  createId,
  detectPlannerNaturalNeed,
  extractTaskCandidates,
  getActorRole,
  normalizeDate,
  normalizeEffort,
  normalizeHorizon,
  normalizeImpactUrgency,
  normalizePlanStatus,
  normalizePriority,
  normalizeTaskStatus,
  normalizeWorkspaceId,
  nowIso,
  parsePipeArgs,
  resolveWorkspaceId,
  stableSortByUpdated,
  summarizePlan,
  summarizeTask,
  uniqueList
};
