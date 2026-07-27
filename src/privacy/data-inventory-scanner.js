'use strict';

const crypto = require('crypto');
const utils = require('./privacy-utils');

const CATEGORIES = {
  telegram_messages: { source: 'telegram', sensitivity: 'private', exportable: false, archiveable: true, deletable: true, ownerOnly: false },
  telegram_session_context: { source: 'telegram', sensitivity: 'private', exportable: false, archiveable: true, deletable: true, ownerOnly: false },
  agent_memory: { source: 'memory', sensitivity: 'private', exportable: true, archiveable: true, deletable: true, ownerOnly: false },
  knowledge_graph: { source: 'knowledge', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  decision_memory: { source: 'knowledge', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  lifeos_tasks: { source: 'lifeos', sensitivity: 'private', exportable: true, archiveable: true, deletable: true, ownerOnly: false },
  lifeos_habits: { source: 'lifeos', sensitivity: 'private', exportable: true, archiveable: true, deletable: true, ownerOnly: false },
  lifeos_mood_energy: { source: 'lifeos', sensitivity: 'sensitive', exportable: false, archiveable: true, deletable: true, ownerOnly: true },
  personal_goals: { source: 'lifeos', sensitivity: 'private', exportable: true, archiveable: true, deletable: true, ownerOnly: false },
  project_goals: { source: 'goals', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  operator_plans: { source: 'operator', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  portfolio_snapshots: { source: 'portfolio', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  executor_proposals: { source: 'executor', sensitivity: 'sensitive', exportable: false, archiveable: true, deletable: false, ownerOnly: false },
  audit_logs: { source: 'audit', sensitivity: 'sensitive', exportable: false, archiveable: true, deletable: false, ownerOnly: false },
  security_findings: { source: 'security', sensitivity: 'sensitive', exportable: false, archiveable: true, deletable: false, ownerOnly: false },
  incident_reports: { source: 'observability', sensitivity: 'sensitive', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  deploy_reports: { source: 'deploy', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  githubops_reports: { source: 'githubops', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  cost_usage: { source: 'cost', sensitivity: 'private', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  improvement_feedback: { source: 'improvement', sensitivity: 'internal', exportable: true, archiveable: true, deletable: true, ownerOnly: false },
  lessons_learned: { source: 'improvement', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  routines: { source: 'routines', sensitivity: 'internal', exportable: true, archiveable: true, deletable: false, ownerOnly: false },
  backups_metadata: { source: 'backup', sensitivity: 'internal', exportable: false, archiveable: false, deletable: false, ownerOnly: false },
  dashboard_settings: { source: 'dashboard', sensitivity: 'sensitive', exportable: false, archiveable: false, deletable: true, ownerOnly: false }
};

function scanDataInventory(workspaceId, services) {
  const inv = [];
  for (const [cat, meta] of Object.entries(CATEGORIES)) {
    inv.push({
      id: utils.generateId(),
      workspaceId: workspaceId || 'default',
      category: cat,
      sourceModule: meta.source,
      description: `${cat.replace(/_/g, ' ')} data`,
      approximateCount: 0,
      sensitivity: meta.sensitivity,
      retentionPolicyId: null,
      exportable: meta.exportable,
      archiveable: meta.archiveable,
      deletable: meta.deletable,
      ownerOnly: meta.ownerOnly,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return inv;
}

function scanModuleDataInventory(moduleName) {
  const results = [];
  for (const [cat, meta] of Object.entries(CATEGORIES)) {
    if (meta.source === moduleName) {
      results.push(cat);
    }
  }
  return results;
}

function estimateDataCounts(workspaceId) {
  const counts = {};
  for (const [cat] of Object.entries(CATEGORIES)) {
    counts[cat] = Math.floor(Math.random() * 100);
  }
  return counts;
}

function detectUnknownDataStores() {
  return [];
}

function buildDataInventoryReport(inventory) {
  const bySource = {};
  const bySensitivity = { public: 0, internal: 0, private: 0, sensitive: 0, secret_blocked: 0 };
  for (const item of inventory) {
    if (!bySource[item.sourceModule]) bySource[item.sourceModule] = [];
    bySource[item.sourceModule].push(item.category);
    if (bySensitivity[item.sensitivity] !== undefined) bySensitivity[item.sensitivity]++;
  }
  return {
    totalCategories: inventory.length,
    bySource: Object.keys(bySource).map(s => ({ source: s, count: bySource[s].length })),
    bySensitivity,
    categories: inventory.map(i => ({ category: i.category, source: i.sourceModule, sensitivity: i.sensitivity, exportable: i.exportable, archiveable: i.archiveable, deletable: i.deletable, ownerOnly: i.ownerOnly }))
  };
}

module.exports = {
  CATEGORIES,
  scanDataInventory,
  scanModuleDataInventory,
  estimateDataCounts,
  detectUnknownDataStores,
  buildDataInventoryReport
};
