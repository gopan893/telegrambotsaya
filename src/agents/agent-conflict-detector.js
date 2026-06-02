'use strict';

const utils = require('./delegation-utils');

function detectConflictingResults(results = []) {
  const text = results.map(item => `${item.resultSummary || ''} ${item.result?.summary || ''}`).join(' ').toLowerCase();
  const conflicts = [];
  if (/\b(tambah|fitur|langsung|besar)\b/.test(text) && /\b(batasi|kecil|stabilisasi|bertahap)\b/.test(text)) {
    conflicts.push({
      type: 'scope_conflict',
      severity: 'medium',
      summary: 'Ada konflik antara menambah scope cepat dan menjaga scope kecil/stabil.'
    });
  }
  if (/\b(mudah|aman|low risk)\b/.test(text) && /\b(risiko|danger|approval|required|berbahaya)\b/.test(text)) {
    conflicts.push({
      type: 'risk_conflict',
      severity: 'high',
      summary: 'Ada sinyal risiko yang tidak selaras antara agent teknis dan risk/security.'
    });
  }
  return conflicts.map(utils.sanitizeDelegationPayload);
}

function detectLowConfidenceResults(results = []) {
  return results
    .filter(item => Number(item.confidence || item.result?.confidence || 0) < 0.5)
    .map(item => ({
      taskId: item.taskId,
      agentId: item.agentId,
      confidence: Number(item.confidence || item.result?.confidence || 0),
      summary: 'Result confidence rendah; perlu validasi manual atau informasi tambahan.'
    }));
}

function detectMissingAgentCoverage(session = {}, results = []) {
  const done = new Set(results.map(item => item.agentId).filter(Boolean));
  return (session.selectedAgents || [])
    .filter(agentId => !done.has(agentId) && agentId !== 'orchestrator')
    .map(agentId => ({ agentId, summary: `${agentId} belum memberi hasil task.` }));
}

function buildConflictSummary(conflicts = []) {
  if (!conflicts.length) return 'Tidak ada konflik penting antar hasil agent.';
  return conflicts.slice(0, 3).map(item => `${item.type}: ${item.summary}`).join(' ');
}

function recommendConflictResolution(conflicts = [], services = {}) {
  if (!conflicts.length) return [];
  return conflicts.map(item => {
    if (item.type === 'risk_conflict') return 'Libatkan Security/Critic dan pilih opsi yang membutuhkan approval paling jelas.';
    if (item.type === 'scope_conflict') return 'Pilih jalur bertahap: scope kecil, test cepat, lalu ekspansi.';
    return 'Minta klarifikasi atau jalankan review singkat sebelum implementasi.';
  });
}

module.exports = {
  buildConflictSummary,
  detectConflictingResults,
  detectLowConfidenceResults,
  detectMissingAgentCoverage,
  recommendConflictResolution
};
