'use strict';

const utils = require('./research-utils');

function determineFreshnessRequirement(task = {}) {
  if (['api_docs', 'deployment', 'external_tools', 'cost'].includes(task.scope)) return 'high';
  if (['project_docs', 'architecture'].includes(task.scope)) return 'local_repo_truth';
  return 'medium';
}

function detectPossiblyOutdatedFinding(finding = {}, services = {}) {
  const text = `${finding.claim || finding.summary || finding.text || ''}`.toLowerCase();
  const needsFresh = /api|pricing|model|render|github|telegram|provider|deploy|webhook/.test(text);
  const sourceDate = finding.retrievedAt || finding.updatedAt || finding.createdAt;
  const ageDays = sourceDate ? (Date.now() - Date.parse(sourceDate)) / (24 * 60 * 60 * 1000) : null;
  return {
    outdated: Boolean(needsFresh && (ageDays === null || ageDays > 45)),
    reason: needsFresh ? 'Provider/deployment/API information may change and should be verified.' : '',
    ageDays: ageDays === null ? null : Math.round(ageDays)
  };
}

function flagOutdatedSources(sources = [], task = {}) {
  const req = determineFreshnessRequirement(task);
  return utils.safeArray(sources).map((source) => {
    const ageDays = source.retrievedAt ? Math.round((Date.now() - Date.parse(source.retrievedAt)) / (24 * 60 * 60 * 1000)) : null;
    const warning = req === 'high' && (ageDays === null || ageDays > 45);
    return { ...source, freshnessWarning: warning ? 'Source may be outdated for high-freshness topic.' : '', ageDays };
  });
}

function buildFreshnessWarning(task = {}) {
  const req = determineFreshnessRequirement(task);
  if (req === 'high') return 'Topik ini membutuhkan sumber terbaru/official. Jika connector web tidak tersedia, bagian live/current harus dianggap unknown.';
  if (req === 'local_repo_truth') return 'Dokumentasi lokal repo dianggap sumber utama untuk state project saat ini.';
  return 'Freshness medium; validasi ulang jika menyangkut provider/runtime modern.';
}

module.exports = {
  buildFreshnessWarning,
  detectPossiblyOutdatedFinding,
  determineFreshnessRequirement,
  flagOutdatedSources
};

