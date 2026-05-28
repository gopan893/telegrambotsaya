'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

function getAIOSStatus(services = {}, userId = '0') {
  try {
    if (services.aiOS?.getStatus && typeof services.ensureUser === 'function') {
      return services.aiOS.getStatus(userId, {
        ensureUser: services.ensureUser,
        persist: services.persist
      });
    }
  } catch (_) {}
  return {};
}

function analyzeMemoryEfficiency(services = {}, userId = '0') {
  const state = store.getOpsState(services);
  const aios = getAIOSStatus(services, userId);
  const telemetrySize = JSON.stringify(state.telemetry || {}).length;
  const staleItemCount = Number(aios.staleGoals || 0) + Number(aios.staleWorkflows || 0);
  const graphSize = Number(aios.graphNodes || 0) + Number(aios.graphEdges || 0);
  const memoryCount = Number(aios.totalMemory || 0);
  const recommendations = [];

  if (telemetrySize > 120000) recommendations.push('Prune telemetry lama dengan /recover confirm prune_telemetry.');
  if (staleItemCount > 0) recommendations.push('Review goal/workflow stale dan arsipkan yang tidak aktif.');
  if (graphSize > 350) recommendations.push('Ringkas knowledge graph atau kurangi node importance rendah.');
  if (memoryCount > 500) recommendations.push('Gunakan context compression lebih agresif.');
  if (recommendations.length === 0) recommendations.push('Memory masih dalam batas sehat.');

  return {
    memoryCount,
    graphNodes: Number(aios.graphNodes || 0),
    graphEdges: Number(aios.graphEdges || 0),
    graphSize,
    telemetrySizeBytes: telemetrySize,
    staleItemCount,
    pruningRecommendation: recommendations[0],
    recommendations
  };
}

function analyzeStorageEfficiency(services = {}) {
  const state = store.getOpsState(services);
  const opsDataSizeBytes = JSON.stringify(state).length;
  const benchmarkHistorySize = (state.benchmarkRuns || []).length;
  const incidentHistorySize = (state.incidents || []).length;
  const eventCount = (state.telemetry?.events || []).length;
  const cleanup = [];

  if (opsDataSizeBytes > 180000) cleanup.push('Prune telemetry/events dan benchmark lama.');
  if (benchmarkHistorySize > 30) cleanup.push('Simpan baseline dan 10 run terbaru saja untuk review manual.');
  if (incidentHistorySize > 50) cleanup.push('Resolve/ignore incident lama dan simpan lesson ringkas.');
  if (eventCount > 200) cleanup.push('Turunkan telemetry sampling rate.');
  if (cleanup.length === 0) cleanup.push('Storage ops masih compact.');

  return {
    opsDataSizeBytes,
    benchmarkHistorySize,
    incidentHistorySize,
    eventCount,
    cleanupSuggestion: cleanup[0],
    recommendations: cleanup
  };
}

function analyzeWorkflowThroughput(services = {}, userId = '0') {
  const aios = getAIOSStatus(services, userId);
  const activeWorkflowCount = Number(aios.activeWorkflows || 0);
  const completedStepRatio = Number(aios.workflowCompletionRatio || 0);
  const stuckWorkflowCount = Number(aios.staleWorkflows || 0) + Number(aios.workflowConflicts || 0);
  const recommendations = [];

  if (stuckWorkflowCount > 0) recommendations.push('Review workflow stale/conflict dengan /workflows dan /workflownext.');
  if (activeWorkflowCount > 8) recommendations.push('Kurangi workflow aktif agar fokus dan memory tetap ringan.');
  if (completedStepRatio < 0.25 && activeWorkflowCount > 0) recommendations.push('Pilih satu workflow utama dan selesaikan step berikutnya.');
  if (recommendations.length === 0) recommendations.push('Throughput workflow terlihat aman.');

  return {
    activeWorkflowCount,
    completedStepRatio,
    stuckWorkflowCount,
    recommendations
  };
}

function analyzeResources(services = {}, userId = '0') {
  return {
    memory: analyzeMemoryEfficiency(services, userId),
    storage: analyzeStorageEfficiency(services),
    workflow: analyzeWorkflowThroughput(services, userId),
    generatedAt: guards.nowIso()
  };
}

module.exports = {
  analyzeMemoryEfficiency,
  analyzeStorageEfficiency,
  analyzeWorkflowThroughput,
  analyzeResources
};
