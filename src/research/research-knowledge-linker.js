'use strict';

const planner = require('./research-task-planner');
const store = require('./research-store');
const utils = require('./research-utils');

function graphModule(services = {}) {
  return services.aiOS?.knowledgeGraph || null;
}

async function createResearchKnowledgeNode(task = {}, services = {}) {
  const graph = graphModule(services);
  if (!graph?.upsertConcept) return { ok: false, reason: 'KNOWLEDGE_GRAPH_UNAVAILABLE' };
  const result = graph.upsertConcept(task.userId, {
    label: `Research: ${task.topic}`,
    type: 'learning_topic',
    summary: utils.sanitizeText(task.summary?.answerSummary || task.question || task.topic, 600),
    source: 'phase43-research',
    sourceId: task.id,
    confidence: task.summary?.confidence || 0.65,
    importance: 0.68,
    tags: ['research', task.scope]
  }, services);
  return result?.ok ? { ok: true, node: result.node } : { ok: false, reason: result?.reason || 'GRAPH_NODE_FAILED' };
}

async function linkResearchToKnowledgeGraph(taskId, services = {}) {
  const task = await planner.getResearchTask(taskId, services);
  if (!task) return { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND', status: 404 };
  const node = await createResearchKnowledgeNode(task, services);
  const linked = [];
  if (node.ok && node.node?.id) linked.push(node.node.id);
  const graph = graphModule(services);
  if (graph?.evolveGraphFromText) {
    const evolved = graph.evolveGraphFromText(task.userId, `${task.topic}. ${task.summary?.answerSummary || task.question || ''}`, services, {
      source: 'phase43-research',
      sourceId: task.id,
      confidence: task.summary?.confidence || 0.65,
      maxConcepts: 5
    });
    if (evolved?.nodes) linked.push(...evolved.nodes.map((item) => item.id).filter(Boolean));
  }
  const updated = { ...task, linkedKnowledgeNodeIds: [...new Set([...(task.linkedKnowledgeNodeIds || []), ...linked])], updatedAt: utils.nowIso() };
  await store.upsertResearchItem(store.RESEARCH_TASKS_KEY, updated, services);
  await utils.auditResearch('research/knowledge_link_created', {
    workspaceId: task.workspaceId,
    userId: task.userId,
    targetId: task.id,
    summary: { linkedKnowledgeNodeIds: updated.linkedKnowledgeNodeIds }
  }, services);
  return { ok: true, task: updated, linkedKnowledgeNodeIds: updated.linkedKnowledgeNodeIds };
}

async function linkResearchToProject(taskId, projectId, services = {}) {
  return linkGeneric(taskId, 'projectId', projectId, services);
}

async function linkResearchToPhase(taskId, phaseNumber, services = {}) {
  return linkGeneric(taskId, 'phaseNumber', String(phaseNumber || ''), services);
}

async function linkResearchToDecision(taskId, decisionId, services = {}) {
  return linkGeneric(taskId, 'decisionId', decisionId, services);
}

async function linkResearchToDocs(taskId, docPath, services = {}) {
  return linkGeneric(taskId, 'docPath', docPath, services);
}

async function linkGeneric(taskId, field, value, services = {}) {
  const task = await planner.getResearchTask(taskId, services);
  if (!task) return { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND', status: 404 };
  const links = { ...(task.links || {}), [field]: utils.sanitizeText(value, 220) };
  const updated = { ...task, links, updatedAt: utils.nowIso() };
  await store.upsertResearchItem(store.RESEARCH_TASKS_KEY, updated, services);
  return { ok: true, task: updated };
}

module.exports = {
  createResearchKnowledgeNode,
  linkResearchToDecision,
  linkResearchToDocs,
  linkResearchToKnowledgeGraph,
  linkResearchToPhase,
  linkResearchToProject
};

