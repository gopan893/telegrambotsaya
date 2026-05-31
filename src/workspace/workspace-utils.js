'use strict';

const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function safeIdPart(value = '') {
  const clean = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return clean || 'unknown';
}

function createWorkspaceId(prefix = 'ws') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function getPersonalWorkspaceId(userId) {
  return `ws_personal_${safeIdPart(userId)}`;
}

function getAdminWorkspaceId(ownerId) {
  return `ws_admin_${safeIdPart(ownerId)}`;
}

function normalizeWorkspaceType(type = 'project') {
  const value = String(type || 'project').toLowerCase();
  return ['personal', 'project', 'team', 'admin'].includes(value) ? value : 'project';
}

function normalizeWorkspaceName(name = '') {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return clean || 'Untitled Workspace';
}

function normalizeWorkspaceDescription(description = '') {
  return String(description || '').replace(/\s+/g, ' ').trim().slice(0, 600);
}

function normalizeRole(role = 'viewer') {
  const value = String(role || 'viewer').toLowerCase();
  return ['owner', 'admin', 'editor', 'viewer', 'guest'].includes(value) ? value : 'viewer';
}

function normalizeMember(member = {}) {
  return {
    userId: String(member.userId || member.user_id || '').trim(),
    role: normalizeRole(member.role),
    status: member.status === 'removed' ? 'removed' : 'active',
    addedAt: member.addedAt || member.added_at || nowIso(),
    updatedAt: member.updatedAt || member.updated_at || member.addedAt || nowIso()
  };
}

function normalizeWorkspace(input = {}) {
  const ownerId = String(input.ownerId || input.owner_id || '').trim();
  const id = String(input.id || createWorkspaceId()).trim();
  const members = Array.isArray(input.members) ? input.members.map(normalizeMember).filter(member => member.userId) : [];
  if (ownerId && !members.some(member => member.userId === ownerId && member.status === 'active')) {
    members.unshift({ userId: ownerId, role: 'owner', status: 'active', addedAt: input.createdAt || nowIso(), updatedAt: input.updatedAt || nowIso() });
  }
  return {
    id,
    name: normalizeWorkspaceName(input.name),
    description: normalizeWorkspaceDescription(input.description),
    type: normalizeWorkspaceType(input.type),
    ownerId,
    members,
    createdAt: input.createdAt || input.created_at || nowIso(),
    updatedAt: input.updatedAt || input.updated_at || nowIso(),
    archivedAt: input.archivedAt || input.archived_at || null
  };
}

function isWorkspaceArchived(workspace = {}) {
  return Boolean(workspace.archivedAt || workspace.archived_at);
}

function getWorkspaceIdFromData(item = {}, fallbackWorkspaceId = '') {
  return item.workspaceId || item.workspace_id || item.metadata?.workspaceId || item.metadata?.workspace_id || fallbackWorkspaceId || '';
}

module.exports = {
  createWorkspaceId,
  getAdminWorkspaceId,
  getPersonalWorkspaceId,
  getWorkspaceIdFromData,
  isWorkspaceArchived,
  normalizeMember,
  normalizeRole,
  normalizeWorkspace,
  normalizeWorkspaceDescription,
  normalizeWorkspaceName,
  normalizeWorkspaceType,
  nowIso,
  safeIdPart
};

