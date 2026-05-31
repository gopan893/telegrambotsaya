'use strict';

const utils = require('./workspace-utils');

const WORKSPACES_KEY = 'workspaces';

function getMemoryBucket(services = {}) {
  if (!services.__workspaceStore) services.__workspaceStore = { [WORKSPACES_KEY]: [] };
  return services.__workspaceStore;
}

async function readWorkspaces(services = {}) {
  if (services.storageManager?.safeRead) {
    try {
      const items = await services.storageManager.safeRead(WORKSPACES_KEY, []);
      return Array.isArray(items) ? items.map(utils.normalizeWorkspace) : [];
    } catch (_) {
      // Storage errors must not break Telegram/dashboard reads; fall through to in-memory fallback.
    }
  }
  const bucket = getMemoryBucket(services);
  return Array.isArray(bucket[WORKSPACES_KEY]) ? bucket[WORKSPACES_KEY].map(utils.normalizeWorkspace) : [];
}

async function writeWorkspaces(workspaces = [], services = {}) {
  const clean = Array.isArray(workspaces) ? workspaces.map(utils.normalizeWorkspace) : [];
  if (services.storageManager?.safeWrite) {
    try {
      await services.storageManager.safeWrite(WORKSPACES_KEY, clean);
      return clean;
    } catch (_) {
      // Keep a process-local fallback if the active storage has a transient failure.
    }
  }
  getMemoryBucket(services)[WORKSPACES_KEY] = clean;
  return clean;
}

async function saveWorkspace(workspace, services = {}) {
  const normalized = utils.normalizeWorkspace(workspace);
  const workspaces = await readWorkspaces(services);
  const index = workspaces.findIndex(item => item.id === normalized.id);
  if (index >= 0) workspaces[index] = { ...workspaces[index], ...normalized, updatedAt: utils.nowIso() };
  else workspaces.push(normalized);
  await writeWorkspaces(workspaces, services);
  return index >= 0 ? workspaces[index] : normalized;
}

async function ensurePersonalWorkspace(userId, services = {}) {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) return null;
  const id = utils.getPersonalWorkspaceId(cleanUserId);
  const existing = await getWorkspace(id, services);
  if (existing) return existing;
  return createWorkspace({
    id,
    name: `Personal Workspace ${cleanUserId}`,
    description: 'Default private workspace.',
    type: 'personal',
    ownerId: cleanUserId
  }, services);
}

async function ensureAdminWorkspace(services = {}) {
  const ownerId = String(services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '').trim();
  if (!ownerId) return null;
  const id = utils.getAdminWorkspaceId(ownerId);
  const existing = await getWorkspace(id, services);
  if (existing) return existing;
  return createWorkspace({
    id,
    name: 'Admin Workspace',
    description: 'Administrative workspace for bot owner.',
    type: 'admin',
    ownerId
  }, services);
}

async function createWorkspace(data = {}, services = {}) {
  const ownerId = String(data.ownerId || data.owner_id || '').trim();
  if (!ownerId) return null;
  const workspace = utils.normalizeWorkspace({
    ...data,
    id: data.id || utils.createWorkspaceId('ws'),
    ownerId,
    members: Array.isArray(data.members) ? data.members : [{ userId: ownerId, role: 'owner', status: 'active' }]
  });
  return saveWorkspace(workspace, services);
}

async function getWorkspace(workspaceId, services = {}) {
  const id = String(workspaceId || '').trim();
  if (!id) return null;
  const workspaces = await readWorkspaces(services);
  return workspaces.find(workspace => workspace.id === id) || null;
}

async function listWorkspacesForUser(userId, services = {}, options = {}) {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) return [];
  await ensurePersonalWorkspace(cleanUserId, services);
  await ensureAdminWorkspace(services);
  const includeArchived = Boolean(options.includeArchived);
  const workspaces = await readWorkspaces(services);
  return workspaces
    .filter(workspace => includeArchived || !utils.isWorkspaceArchived(workspace))
    .filter(workspace => workspace.ownerId === cleanUserId || workspace.members.some(member => member.userId === cleanUserId && member.status === 'active'))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function listAllWorkspaces(services = {}, options = {}) {
  await ensureAdminWorkspace(services);
  const includeArchived = Boolean(options.includeArchived);
  const workspaces = await readWorkspaces(services);
  return workspaces
    .filter(workspace => includeArchived || !utils.isWorkspaceArchived(workspace))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function addWorkspaceMember(workspaceId, userId, role = 'viewer', services = {}) {
  const workspace = await getWorkspace(workspaceId, services);
  const cleanUserId = String(userId || '').trim();
  if (!workspace || !cleanUserId) return null;
  const member = {
    userId: cleanUserId,
    role: utils.normalizeRole(role),
    status: 'active',
    addedAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  };
  const index = workspace.members.findIndex(item => item.userId === cleanUserId);
  if (index >= 0) workspace.members[index] = { ...workspace.members[index], ...member, addedAt: workspace.members[index].addedAt || member.addedAt };
  else workspace.members.push(member);
  workspace.updatedAt = utils.nowIso();
  return saveWorkspace(workspace, services);
}

async function updateWorkspaceMemberRole(workspaceId, userId, role = 'viewer', services = {}) {
  const workspace = await getWorkspace(workspaceId, services);
  const cleanUserId = String(userId || '').trim();
  if (!workspace || !cleanUserId) return null;
  const normalizedRole = utils.normalizeRole(role);
  const index = workspace.members.findIndex(item => item.userId === cleanUserId && item.status === 'active');
  if (index < 0) return null;
  workspace.members[index] = { ...workspace.members[index], role: normalizedRole, updatedAt: utils.nowIso() };
  workspace.updatedAt = utils.nowIso();
  return saveWorkspace(workspace, services);
}

async function removeWorkspaceMember(workspaceId, userId, services = {}) {
  const workspace = await getWorkspace(workspaceId, services);
  const cleanUserId = String(userId || '').trim();
  if (!workspace || !cleanUserId || workspace.ownerId === cleanUserId) return null;
  const index = workspace.members.findIndex(item => item.userId === cleanUserId && item.status === 'active');
  if (index < 0) return null;
  workspace.members[index] = { ...workspace.members[index], status: 'removed', updatedAt: utils.nowIso() };
  workspace.updatedAt = utils.nowIso();
  return saveWorkspace(workspace, services);
}

async function archiveWorkspace(workspaceId, services = {}) {
  const workspace = await getWorkspace(workspaceId, services);
  if (!workspace || workspace.type === 'personal') return null;
  workspace.archivedAt = workspace.archivedAt || utils.nowIso();
  workspace.updatedAt = utils.nowIso();
  return saveWorkspace(workspace, services);
}

async function getDefaultWorkspaceForUser(userId, services = {}) {
  return ensurePersonalWorkspace(userId, services);
}

module.exports = {
  WORKSPACES_KEY,
  addWorkspaceMember,
  archiveWorkspace,
  createWorkspace,
  ensureAdminWorkspace,
  ensurePersonalWorkspace,
  getDefaultWorkspaceForUser,
  getWorkspace,
  listAllWorkspaces,
  listWorkspacesForUser,
  readWorkspaces,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  writeWorkspaces
};
