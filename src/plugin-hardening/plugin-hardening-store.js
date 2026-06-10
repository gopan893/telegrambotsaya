'use strict';

const store = {
  plugins: new Map(),
  compatibility: new Map(),
  permissions: new Map(),
  sandboxPolicies: new Map(),
  lifecycle: new Map(),
  health: new Map(),
  risks: new Map(),
  upgradePlans: new Map(),
  deprecations: new Map(),
  certifications: new Map(),
  reports: new Map()
};

function getPluginHardening(pluginId) {
  return store.plugins.get(String(pluginId)) || null;
}

function setPluginHardening(pluginId, data) {
  store.plugins.set(String(pluginId), { ...data, id: pluginId, updatedAt: new Date().toISOString() });
  return getPluginHardening(pluginId);
}

function removePluginHardening(pluginId) {
  return store.plugins.delete(String(pluginId));
}

function listPluginHardening(filter) {
  let arr = Array.from(store.plugins.values());
  if (filter && filter.status) arr = arr.filter(p => p.status === filter.status);
  return arr;
}

function getCompatibility(pluginId) {
  return store.compatibility.get(String(pluginId)) || null;
}

function setCompatibility(pluginId, data) {
  store.compatibility.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getCompatibility(pluginId);
}

function getPermissions(pluginId) {
  return store.permissions.get(String(pluginId)) || null;
}

function setPermissions(pluginId, data) {
  store.permissions.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getPermissions(pluginId);
}

function getSandboxPolicy(pluginId) {
  return store.sandboxPolicies.get(String(pluginId)) || null;
}

function setSandboxPolicy(pluginId, data) {
  store.sandboxPolicies.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getSandboxPolicy(pluginId);
}

function getLifecycle(pluginId) {
  return store.lifecycle.get(String(pluginId)) || null;
}

function setLifecycle(pluginId, data) {
  store.lifecycle.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getLifecycle(pluginId);
}

function getHealth(pluginId) {
  return store.health.get(String(pluginId)) || null;
}

function setHealth(pluginId, data) {
  store.health.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getHealth(pluginId);
}

function getRisk(pluginId) {
  return store.risks.get(String(pluginId)) || null;
}

function setRisk(pluginId, data) {
  store.risks.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getRisk(pluginId);
}

function getUpgradePlan(pluginId) {
  return store.upgradePlans.get(String(pluginId)) || null;
}

function setUpgradePlan(pluginId, data) {
  store.upgradePlans.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getUpgradePlan(pluginId);
}

function getDeprecation(pluginId) {
  return store.deprecations.get(String(pluginId)) || null;
}

function setDeprecation(pluginId, data) {
  store.deprecations.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getDeprecation(pluginId);
}

function getCertification(pluginId) {
  return store.certifications.get(String(pluginId)) || null;
}

function setCertification(pluginId, data) {
  store.certifications.set(String(pluginId), { ...data, pluginId, updatedAt: new Date().toISOString() });
  return getCertification(pluginId);
}

function getReport(reportId) {
  return store.reports.get(String(reportId)) || null;
}

function setReport(reportId, data) {
  store.reports.set(String(reportId), { ...data, id: reportId, createdAt: new Date().toISOString() });
  return getReport(reportId);
}

function listReports() {
  return Array.from(store.reports.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function getStats() {
  return {
    plugins: store.plugins.size,
    compatibility: store.compatibility.size,
    permissions: store.permissions.size,
    sandboxPolicies: store.sandboxPolicies.size,
    lifecycle: store.lifecycle.size,
    health: store.health.size,
    risks: store.risks.size,
    upgradePlans: store.upgradePlans.size,
    deprecations: store.deprecations.size,
    certifications: store.certifications.size,
    reports: store.reports.size
  };
}

function resetStore() {
  for (const map of Object.values(store)) {
    map.clear();
  }
}

module.exports = {
  getPluginHardening, setPluginHardening, removePluginHardening, listPluginHardening,
  getCompatibility, setCompatibility,
  getPermissions, setPermissions,
  getSandboxPolicy, setSandboxPolicy,
  getLifecycle, setLifecycle,
  getHealth, setHealth,
  getRisk, setRisk,
  getUpgradePlan, setUpgradePlan,
  getDeprecation, setDeprecation,
  getCertification, setCertification,
  getReport, setReport, listReports,
  getStats, resetStore
};
