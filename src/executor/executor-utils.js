'use strict';

const crypto = require('crypto');
const dashboardGuards = require('../dashboard/dashboard-guards');
const workspace = require('../workspace');

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RISK_ORDER = { low: 1, medium: 2, high: 3, danger: 4 };

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'exec') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function createApprovalToken() {
  return crypto.randomBytes(12).toString('hex');
}

function compactText(value = '', max = 360) {
  const clean = dashboardGuards.preventSecretLeak(String(value || '').replace(/\s+/g, ' ').trim());
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function normalizeRiskLevel(value = 'low') {
  const clean = String(value || 'low').toLowerCase();
  return ['low', 'medium', 'high', 'danger'].includes(clean) ? clean : 'low';
}

function maxRiskLevel(values = []) {
  let max = 'low';
  for (const value of values) {
    const risk = normalizeRiskLevel(value);
    if ((RISK_ORDER[risk] || 0) > (RISK_ORDER[max] || 0)) max = risk;
  }
  return max;
}

function normalizeProposalStatus(value = 'pending_approval') {
  const clean = String(value || 'pending_approval').toLowerCase();
  return [
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'running',
    'completed',
    'failed',
    'expired',
    'cancelled'
  ].includes(clean) ? clean : 'pending_approval';
}

function normalizeSourceType(value = 'manual') {
  const clean = String(value || 'manual').toLowerCase();
  return ['manual', 'planner_task', 'goal', 'workflow', 'ops', 'dashboard'].includes(clean) ? clean : 'manual';
}

function normalizeActionStatus(value = 'pending_approval') {
  const clean = String(value || 'pending_approval').toLowerCase();
  return ['pending_approval', 'approved', 'running', 'completed', 'failed', 'skipped', 'cancelled'].includes(clean) ? clean : 'pending_approval';
}

function expiryIso(ms = DEFAULT_EXPIRY_MS) {
  return new Date(Date.now() + ms).toISOString();
}

function isExpired(item = {}) {
  if (!item.expiresAt) return false;
  return new Date(item.expiresAt).getTime() <= Date.now();
}

function normalizeWorkspaceId(userId, workspaceId = '') {
  const clean = String(workspaceId || '').trim();
  if (clean) return clean;
  return workspace.utils.getPersonalWorkspaceId(userId);
}

async function resolveWorkspaceId(userId, workspaceId, services = {}) {
  if (workspaceId) return String(workspaceId).trim();
  try {
    const item = await workspace.store.getDefaultWorkspaceForUser(userId, services);
    return item?.id || normalizeWorkspaceId(userId);
  } catch (_) {
    return normalizeWorkspaceId(userId);
  }
}

function parsePipeArgs(args = '') {
  return String(args || '')
    .split('|')
    .map(part => part.trim());
}

function summarizeAction(action = {}) {
  return {
    id: action.id,
    type: action.type,
    targetType: action.targetType,
    targetId: action.targetId,
    riskLevel: action.riskLevel,
    status: action.status,
    description: compactText(action.description || '', 180)
  };
}

function summarizeProposal(proposal = {}) {
  return {
    id: proposal.id,
    sourceType: proposal.sourceType,
    sourceId: proposal.sourceId,
    title: compactText(proposal.title || '', 140),
    riskLevel: proposal.riskLevel,
    status: proposal.status,
    actionCount: Array.isArray(proposal.proposedActions) ? proposal.proposedActions.length : 0,
    workspaceId: proposal.workspaceId,
    userId: proposal.userId
  };
}

function summarizeRun(run = {}) {
  return {
    id: run.id,
    proposalId: run.proposalId,
    status: run.status,
    actionCount: Array.isArray(run.actionResults) ? run.actionResults.length : 0,
    resultSummary: compactText(run.resultSummary || '', 200),
    errorSummary: compactText(run.errorSummary || '', 200)
  };
}

function detectExecutorNaturalNeed(text = '') {
  const clean = String(text || '').trim();
  const lower = clean.toLowerCase();
  if (!clean || clean.startsWith('/')) return { shouldUse: false, reason: 'empty_or_command', confidence: 0 };
  if (/^(halo|hai|hi|hello|ok|oke|sip|makasih|terima kasih)$/i.test(lower)) return { shouldUse: false, reason: 'simple', confidence: 0 };
  const keywords = [
    'jalankan task',
    'eksekusi task',
    'eksekusi langkah',
    'selesaikan task',
    'buatkan proposal eksekusi',
    'proposal eksekusi',
    'apa yang bisa kamu jalankan',
    'approve eksekusi',
    'run task'
  ];
  const matches = keywords.filter(keyword => lower.includes(keyword));
  return {
    shouldUse: matches.length > 0,
    reason: matches.length ? `matched:${matches.slice(0, 3).join(',')}` : 'none',
    confidence: Math.min(0.95, matches.length * 0.3)
  };
}

function extractLikelyTaskId(text = '') {
  const match = String(text || '').match(/\btask_[a-zA-Z0-9_.:@-]+/);
  return match ? match[0] : '';
}

module.exports = {
  DEFAULT_EXPIRY_MS,
  RISK_ORDER,
  compactText,
  createApprovalToken,
  createId,
  detectExecutorNaturalNeed,
  expiryIso,
  extractLikelyTaskId,
  isExpired,
  maxRiskLevel,
  normalizeActionStatus,
  normalizeProposalStatus,
  normalizeRiskLevel,
  normalizeSourceType,
  normalizeWorkspaceId,
  nowIso,
  parsePipeArgs,
  resolveWorkspaceId,
  summarizeAction,
  summarizeProposal,
  summarizeRun
};
