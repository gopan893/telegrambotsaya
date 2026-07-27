'use strict';

const aiMonitor = require('./local-ai-node-monitor');
const aiChecker = require('./local-ai-endpoint-checker');
const nasMonitor = require('./nas-node-monitor');
const fileSync = require('./file-sync-status-checker');
const tunnelMonitor = require('./tunnel-status-monitor');

function generateAiReport() {
  const endpoints = aiMonitor.listEndpoints();
  const stats = aiMonitor.getMonitorStats();
  const unhealthy = aiMonitor.detectUnhealthyEndpoints();
  return {
    ok: true,
    report: {
      endpoints: endpoints.map(e => ({
        id: e.id, name: e.name, status: e.status,
        latencyMs: e.metrics.latencyMs, errorCount: e.errorCount,
        consecutiveFailures: e.consecutiveFailures, lastCheckAt: e.lastCheckAt
      })),
      stats,
      unhealthyCount: unhealthy.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateNasReport() {
  const nodes = nasMonitor.listNasNodes();
  const stats = nasMonitor.getMonitorStats();
  return {
    ok: true,
    report: {
      nodes: nodes.map(n => ({
        id: n.id, name: n.name, status: n.status,
        storage: n.storage, syncStatus: n.syncStatus,
        backupStatus: n.backupStatus, lastCheckAt: n.lastCheckAt
      })),
      stats,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateFileSyncReport() {
  const jobs = fileSync.listSyncJobs();
  const summary = fileSync.getSyncSummary();
  const errors = fileSync.detectSyncErrors();
  return {
    ok: true,
    report: {
      jobs: jobs.map(j => ({
        id: j.id, sourcePath: j.sourcePath, targetPath: j.targetPath,
        status: j.status, fileCount: j.fileCount, lastSyncAt: j.lastSyncAt,
        errorCount: j.errorCount, lastError: j.lastError
      })),
      summary,
      errorCount: errors.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateTunnelReport() {
  const tunnels = tunnelMonitor.listTunnels();
  const stats = tunnelMonitor.getMonitorStats();
  const inactive = tunnelMonitor.detectInactiveTunnels();
  return {
    ok: true,
    report: {
      tunnels: tunnels.map(t => ({
        id: t.id, name: t.name, url: t.url, status: t.status,
        lastCheckAt: t.lastCheckAt, consecutiveFailures: t.consecutiveFailures
      })),
      stats,
      inactiveCount: inactive.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function generateFullReport() {
  const ai = generateAiReport();
  const nas = generateNasReport();
  const file = generateFileSyncReport();
  const tunnel = generateTunnelReport();
  return {
    ok: true,
    report: {
      aiEndpoints: ai.ok ? ai.report : { error: ai.error },
      nasNodes: nas.ok ? nas.report : { error: nas.error },
      fileSync: file.ok ? file.report : { error: file.error },
      tunnels: tunnel.ok ? tunnel.report : { error: tunnel.error },
      generatedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  generateAiReport, generateNasReport, generateFileSyncReport,
  generateTunnelReport, generateFullReport
};
