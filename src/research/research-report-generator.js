'use strict';

const docAgent = require('./documentation-agent');
const gapDetector = require('./research-gap-detector');
const scorer = require('./source-credibility-scorer');
const store = require('./research-store');
const summarizer = require('./research-summarizer');
const planner = require('./research-task-planner');
const utils = require('./research-utils');

async function generateResearchReport(taskId, services = {}) {
  const result = await summarizer.summarizeResearchTask(taskId, services);
  if (!result.ok) return result;
  const task = result.task;
  return {
    ok: true,
    report: {
      id: utils.createId('research_report'),
      taskId,
      topic: task.topic,
      findings: task.findings || [],
      evidence: task.evidence || [],
      confidence: result.summary.confidence,
      gaps: task.gaps || [],
      docsImpact: docAgent.analyzeDocumentationNeed({ topic: task.topic, question: task.question }, services),
      knowledgeGraphLinks: task.linkedKnowledgeNodeIds || [],
      recommendedNextAction: result.summary.recommendations[0] || 'Collect more evidence.',
      createdAt: utils.nowIso()
    }
  };
}

async function generateSourceCredibilityReport(taskId, services = {}) {
  const task = await planner.getResearchTask(taskId, services);
  if (!task) return { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND', status: 404 };
  return { ok: true, report: scorer.buildSourceCredibilityReport(task.sources || [], task) };
}

async function generateDocumentationGapReport(services = {}) {
  const topics = ['env', 'commands', 'architecture', 'testing', 'deployment', 'research'];
  const items = topics.map((topic) => {
    const need = docAgent.analyzeDocumentationNeed({ topic }, services);
    return {
      topic,
      docType: need.docType,
      needsUpdate: need.needsUpdate,
      reason: need.reason,
      topDocs: need.existingDocs.slice(0, 3).map((doc) => ({ docPath: doc.docPath, relevance: doc.relevance }))
    };
  });
  return { ok: true, items, generatedAt: utils.nowIso() };
}

async function generateDocsSyncReport(services = {}) {
  const gaps = await generateDocumentationGapReport(services);
  return {
    ok: true,
    status: gaps.items.some((item) => item.needsUpdate) ? 'needs_review' : 'ok',
    gaps: gaps.items.filter((item) => item.needsUpdate),
    generatedAt: utils.nowIso()
  };
}

async function generateResearchActivitySummary(filters = {}, services = {}) {
  const tasks = await store.listResearchItems(store.RESEARCH_TASKS_KEY, filters, services);
  return {
    ok: true,
    totalTasks: tasks.length,
    byStatus: tasks.reduce((acc, task) => {
      acc[task.status || 'unknown'] = (acc[task.status || 'unknown'] || 0) + 1;
      return acc;
    }, {}),
    latest: tasks.slice(0, 5).map((task) => ({
      id: task.id,
      topic: task.topic,
      status: task.status,
      scope: task.scope,
      updatedAt: task.updatedAt
    }))
  };
}

module.exports = {
  generateDocumentationGapReport,
  generateDocsSyncReport,
  generateResearchActivitySummary,
  generateResearchReport,
  generateSourceCredibilityReport
};

