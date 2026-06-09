'use strict';

const auditResults = new Map();
const reports = new Map();
let roadmap = null;

function setAuditResult(key, data) {
  if (!key || data === undefined) throw new Error('key and data are required');
  auditResults.set(String(key), JSON.parse(JSON.stringify(data)));
}

function getAuditResult(key) {
  const entry = auditResults.get(String(key));
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function listAuditResults() {
  const out = {};
  for (const [key, val] of auditResults) {
    out[key] = JSON.parse(JSON.stringify(val));
  }
  return out;
}

function setReport(type, data) {
  if (!type || data === undefined) throw new Error('type and data are required');
  reports.set(String(type), JSON.parse(JSON.stringify(data)));
}

function getReport(type) {
  const entry = reports.get(String(type));
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function setRoadmap(data) {
  roadmap = data ? JSON.parse(JSON.stringify(data)) : null;
}

function getRoadmap() {
  return roadmap ? JSON.parse(JSON.stringify(roadmap)) : null;
}

function resetStore() {
  auditResults.clear();
  reports.clear();
  roadmap = null;
}

function getStats() {
  return {
    auditResultCount: auditResults.size,
    reportCount: reports.size,
    hasRoadmap: roadmap !== null
  };
}

module.exports = {
  setAuditResult,
  getAuditResult,
  listAuditResults,
  setReport,
  getReport,
  setRoadmap,
  getRoadmap,
  resetStore,
  getStats
};
