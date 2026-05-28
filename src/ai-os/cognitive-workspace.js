'use strict';

const guards = require('./guards');
const knowledgeGraph = require('./knowledge-graph');

function createWorkspace(userId, input = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const title = guards.sanitizeText(input.title || '', 160);
  if (!title) return { ok: false, reason: 'TITLE_REQUIRED' };
  const ts = guards.nowIso();
  const workspace = {
    id: input.id || guards.stableId('ws', `${userId}:${title}`),
    userId: guards.normalizeUserId(userId),
    title,
    description: guards.sanitizeText(input.description || '', 800),
    notes: guards.safeArray(input.notes).slice(0, 40).map(normalizeNote),
    goalIds: guards.safeArray(input.goalIds).slice(0, 20),
    workflowIds: guards.safeArray(input.workflowIds).slice(0, 20),
    graphNodeIds: guards.safeArray(input.graphNodeIds).slice(0, 40),
    createdAt: ts,
    updatedAt: ts
  };
  state.workspaces.push(workspace);
  state.workspaces = guards.pruneListByScore(state.workspaces, guards.DEFAULT_LIMITS.workspaces, scoreWorkspace);
  const graph = knowledgeGraph.evolveGraphFromText(userId, `Workspace ${workspace.title}. ${workspace.description}`, botServices, {
    source: 'cognitive-workspace',
    confidence: 0.68,
    maxConcepts: 5
  });
  if (graph.ok) workspace.graphNodeIds = graph.nodes.map((node) => node.id).slice(0, 40);
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workspace };
}

function updateWorkspace(userId, workspaceId, patch = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return { ok: false, reason: 'WORKSPACE_NOT_FOUND' };
  if (patch.title !== undefined) {
    const title = guards.sanitizeText(patch.title, 160);
    if (!title) return { ok: false, reason: 'TITLE_REQUIRED' };
    workspace.title = title;
  }
  if (patch.description !== undefined) workspace.description = guards.sanitizeText(patch.description, 800);
  if (patch.note) {
    const note = normalizeNote(patch.note);
    workspace.notes.push(note);
    const graph = knowledgeGraph.evolveGraphFromText(userId, note.text, botServices, {
      source: 'workspace-note',
      confidence: 0.64,
      maxConcepts: 5
    });
    if (graph.ok) {
      workspace.graphNodeIds = [...new Set([...(workspace.graphNodeIds || []), ...graph.nodes.map((node) => node.id)])].slice(-40);
    }
  }
  workspace.notes = workspace.notes.slice(-60);
  workspace.updatedAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workspace };
}

function listWorkspaces(userId, botServices, limit = 10) {
  const state = guards.ensureAIOSState(userId, botServices);
  return state.workspaces
    .sort((a, b) => scoreWorkspace(b) - scoreWorkspace(a))
    .slice(0, limit);
}

function getActiveWorkspace(userId, botServices) {
  return listWorkspaces(userId, botServices, 1)[0] || null;
}

function attachGoal(userId, workspaceId, goalId, botServices) {
  return attachToWorkspace(userId, workspaceId, 'goalIds', goalId, botServices);
}

function attachWorkflow(userId, workspaceId, workflowId, botServices) {
  return attachToWorkspace(userId, workspaceId, 'workflowIds', workflowId, botServices);
}

function attachGraphNode(userId, workspaceId, nodeId, botServices) {
  return attachToWorkspace(userId, workspaceId, 'graphNodeIds', nodeId, botServices);
}

function synthesizeNotes(userId, workspaceId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workspace = state.workspaces.find((item) => item.id === workspaceId) || state.workspaces[0];
  if (!workspace) return 'Belum ada cognitive workspace.';
  const notes = guards.safeArray(workspace.notes).slice(-8).map((note) => `- ${note.text}`).join('\n') || '-';
  return [
    `Workspace: ${workspace.title}`,
    guards.compactText(workspace.description || '-', 260),
    'Catatan terakhir:',
    notes,
    `Linked goals: ${workspace.goalIds.length}`,
    `Linked workflows: ${workspace.workflowIds.length}`,
    `Linked graph nodes: ${workspace.graphNodeIds.length}`
  ].join('\n');
}

function addNote(userId, workspaceId, note, botServices) {
  return updateWorkspace(userId, workspaceId, { note }, botServices);
}

function attachToWorkspace(userId, workspaceId, field, value, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return { ok: false, reason: 'WORKSPACE_NOT_FOUND' };
  const clean = guards.sanitizeText(value, 100);
  if (!clean) return { ok: false, reason: 'VALUE_REQUIRED' };
  if (!workspace[field].includes(clean)) workspace[field].push(clean);
  workspace[field] = workspace[field].slice(-40);
  workspace.updatedAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workspace };
}

function normalizeNote(note) {
  const text = typeof note === 'string' ? note : note.text;
  return {
    id: note.id || guards.stableId('note', text),
    text: guards.sanitizeText(text, 700),
    tags: guards.uniqueList(note.tags || [], 8),
    createdAt: note.createdAt || guards.nowIso()
  };
}

function scoreWorkspace(workspace) {
  const notes = Math.min(0.3, guards.safeArray(workspace.notes).length * 0.03);
  const links = Math.min(0.25, (workspace.goalIds.length + workspace.workflowIds.length + workspace.graphNodeIds.length) * 0.03);
  const updated = Date.parse(workspace.updatedAt || workspace.createdAt || 0);
  const recency = updated ? Math.max(0, 0.3 - ((Date.now() - updated) / (120 * 24 * 60 * 60 * 1000))) : 0.1;
  return notes + links + recency;
}

function resetWorkspaces(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.workspaces = [];
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  createWorkspace,
  updateWorkspace,
  listWorkspaces,
  getActiveWorkspace,
  attachGoal,
  attachWorkflow,
  attachGraphNode,
  addNote,
  synthesizeNotes,
  resetWorkspaces
};
