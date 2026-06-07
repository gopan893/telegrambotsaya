'use strict';

const fs = require('fs');
const path = require('path');
const scorer = require('./source-credibility-scorer');
const store = require('./research-store');
const planner = require('./research-task-planner');
const utils = require('./research-utils');

const DOC_CANDIDATES = [
  'AGENTS.md',
  'README.md',
  'docs/AGENT_HANDOFF.md',
  'docs/ARCHITECTURE_MAP.md',
  'docs/INTEGRATION_CONTRACT.md',
  'docs/TESTING.md',
  'docs/COMMANDS.md',
  'docs/RENDER_DEPLOYMENT.md',
  'docs/DEPLOYMENT_RELEASE_MANAGER.md',
  'docs/PRODUCTION_OBSERVABILITY.md',
  'docs/MULTI_PROJECT_PORTFOLIO_MANAGER.md',
  'docs/COST_TOKEN_GOVERNANCE.md',
  'docs/KNOWLEDGE_GRAPH.md'
];

function sourceId(taskId, value) {
  return `src_${utils.checksum({ taskId, value }).slice(0, 12)}`;
}

function safeReadProjectFile(relativePath) {
  const root = process.cwd();
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(root)) return null;
  if (!fs.existsSync(fullPath)) return null;
  const stat = fs.statSync(fullPath);
  if (!stat.isFile() || stat.size > 400_000) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function buildDocSource(task, docPath, content) {
  const query = `${task.topic || ''} ${task.question || ''}`;
  const lines = String(content || '').split(/\n+/);
  const ranked = lines
    .map((line) => ({ line: line.trim(), score: utils.textScore(query, line) }))
    .filter((item) => item.line.length > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.line);
  const fallback = lines.find((line) => line.trim().length > 20) || '';
  const excerpt = ranked.length ? ranked.join(' ') : fallback;
  return {
    id: sourceId(task.id, docPath),
    taskId: task.id,
    type: 'project_doc',
    title: docPath,
    summary: utils.sanitizeText(excerpt || `Project documentation file ${docPath}`, 600),
    url: '',
    docPath,
    sourceId: docPath,
    retrievedAt: utils.nowIso(),
    freshness: 'local_repo_truth',
    credibilityScore: 90,
    safeExcerpt: utils.sanitizeText(excerpt, 900),
    status: excerpt ? 'collected' : 'available'
  };
}

async function collectFromProjectDocs(task = {}, services = {}) {
  const sources = [];
  for (const docPath of DOC_CANDIDATES) {
    const content = safeReadProjectFile(docPath);
    if (!content) continue;
    const score = utils.textScore(`${task.topic || ''} ${task.question || ''}`, `${docPath} ${content.slice(0, 8000)}`);
    if (score > 0 || ['AGENTS.md', 'README.md', 'docs/ARCHITECTURE_MAP.md', 'docs/COMMANDS.md'].includes(docPath)) {
      sources.push(buildDocSource(task, docPath, content));
    }
  }
  return sources
    .sort((a, b) => utils.textScore(`${task.topic} ${task.question}`, `${b.title} ${b.summary}`) - utils.textScore(`${task.topic} ${task.question}`, `${a.title} ${a.summary}`))
    .slice(0, 8);
}

async function collectFromKnowledgeGraph(task = {}, services = {}) {
  const graph = services.aiOS?.knowledgeGraph;
  if (!graph?.searchGraph) return [];
  try {
    const result = graph.searchGraph(task.userId, `${task.topic} ${task.question}`, services, 8) || {};
    return utils.safeArray(result.nodes).slice(0, 6).map((node) => ({
      id: sourceId(task.id, `kg:${node.id || node.label}`),
      taskId: task.id,
      type: 'knowledge',
      title: node.label || node.id || 'Knowledge node',
      summary: utils.sanitizeText(node.summary || node.label || '', 500),
      url: '',
      docPath: '',
      sourceId: node.id || node.label,
      retrievedAt: utils.nowIso(),
      freshness: 'memory',
      credibilityScore: Math.round((node.confidence || 0.65) * 100),
      safeExcerpt: utils.sanitizeText(node.summary || node.label || '', 700),
      status: 'collected'
    }));
  } catch (_) {
    return [];
  }
}

async function collectFromConfiguredSearchConnector(task = {}, services = {}) {
  const hasSearch = Boolean(services.env?.TAVILY_API_KEY || process.env.TAVILY_API_KEY || services.searchConnector);
  if (!task.sourceRequirements?.externalSearchNeeded && !task.plan?.externalSearchNeeded) return [];
  if (!hasSearch) {
    return [{
      id: sourceId(task.id, 'search-connector-missing'),
      taskId: task.id,
      type: 'connector',
      title: 'Search connector unavailable',
      summary: 'External search connector is not configured. Use project docs/knowledge or configure a search provider for current web evidence.',
      url: '',
      docPath: '',
      sourceId: 'search-connector',
      retrievedAt: utils.nowIso(),
      freshness: 'unknown',
      credibilityScore: 0,
      safeExcerpt: 'Search provider missing; no external source was collected.',
      status: 'degraded'
    }];
  }
  return [{
    id: sourceId(task.id, 'search-connector-readonly'),
    taskId: task.id,
    type: 'connector',
    title: 'Configured search connector',
    summary: 'A search connector appears configured, but Phase 43 collector does not run background crawling. Use explicit read-only connector integration for live source retrieval.',
    url: '',
    docPath: '',
    sourceId: 'search-connector',
    retrievedAt: utils.nowIso(),
    freshness: 'needs_live_check',
    credibilityScore: 55,
    safeExcerpt: 'Connector available; live source collection is intentionally manual/read-only.',
    status: 'manual_check_required'
  }];
}

async function collectFromIntegrationDocs(task = {}, services = {}) {
  const docs = ['docs/EXTERNAL_INTEGRATIONS.md', 'docs/APPROVED_EXTERNAL_EXECUTION.md', 'docs/TOOL_REGISTRY.md']
    .map((docPath) => {
      const content = safeReadProjectFile(docPath);
      return content ? buildDocSource(task, docPath, content) : null;
    })
    .filter(Boolean);
  return docs.slice(0, 4);
}

function buildSourceCollectionReport(task = {}, sources = []) {
  const report = scorer.buildSourceCredibilityReport(sources, task);
  return {
    taskId: task.id,
    totalSources: sources.length,
    collected: sources.filter((source) => source.status === 'collected').length,
    degraded: sources.filter((source) => source.status === 'degraded' || source.status === 'manual_check_required').length,
    averageCredibility: report.averageCredibility,
    warnings: report.warnings,
    sources: report.sources
  };
}

async function collectSourcesForTask(taskOrId, services = {}) {
  const task = typeof taskOrId === 'string' ? await planner.getResearchTask(taskOrId, services) : taskOrId;
  if (!task) return { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND', status: 404 };
  const groups = await Promise.all([
    collectFromProjectDocs(task, services),
    collectFromKnowledgeGraph(task, services),
    collectFromConfiguredSearchConnector(task, services),
    collectFromIntegrationDocs(task, services)
  ]);
  const byId = new Map();
  for (const source of groups.flat()) byId.set(source.id, source);
  const sources = Array.from(byId.values()).map((source) => ({
    ...source,
    credibilityScore: scorer.scoreSourceCredibility(source, task)
  }));
  const report = buildSourceCollectionReport(task, sources, services);
  const updated = { ...task, sources: report.sources, sourceReport: report, status: 'collecting', updatedAt: utils.nowIso() };
  await store.upsertResearchItem(store.RESEARCH_TASKS_KEY, updated, services);
  await utils.auditResearch('research/source_collected', {
    workspaceId: task.workspaceId,
    userId: task.userId,
    targetId: task.id,
    summary: { totalSources: sources.length, degraded: report.degraded }
  }, services);
  return { ok: true, task: updated, sources: report.sources, report };
}

module.exports = {
  buildSourceCollectionReport,
  collectFromConfiguredSearchConnector,
  collectFromIntegrationDocs,
  collectFromKnowledgeGraph,
  collectFromProjectDocs,
  collectSourcesForTask
};

