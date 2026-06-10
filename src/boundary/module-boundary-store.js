'use strict';

const manifests = new Map();

function registerModuleManifest(manifest) {
  if (!manifest || !manifest.module) return null;
  const now = new Date().toISOString();
  const entry = {
    id: manifest.id || `manifest-${manifest.module}-${Date.now()}`,
    module: manifest.module,
    title: manifest.title || manifest.module,
    description: manifest.description || '',
    category: manifest.category || 'general',
    criticality: manifest.criticality || 'optional',
    entryFiles: manifest.entryFiles || [],
    dashboardTabs: manifest.dashboardTabs || [],
    apiRoutes: manifest.apiRoutes || [],
    telegramCommands: manifest.telegramCommands || [],
    capabilities: manifest.capabilities || [],
    storageAccess: manifest.storageAccess || [],
    requiredEnvNames: manifest.requiredEnvNames || [],
    optionalEnvNames: manifest.optionalEnvNames || [],
    dependencies: manifest.dependencies || [],
    optionalDependencies: manifest.optionalDependencies || [],
    ownerModule: manifest.ownerModule || null,
    status: manifest.status || 'not_loaded',
    createdAt: manifest.createdAt || now,
    updatedAt: now
  };
  manifests.set(manifest.module, entry);
  return entry;
}

function getModuleManifest(moduleName) {
  return manifests.get(moduleName) || null;
}

function listModuleManifests(filters) {
  let result = Array.from(manifests.values());
  if (filters) {
    if (filters.criticality) result = result.filter(m => m.criticality === filters.criticality);
    if (filters.status) result = result.filter(m => m.status === filters.status);
    if (filters.category) result = result.filter(m => m.category === filters.category);
  }
  return result;
}

function clearAll() {
  manifests.clear();
}

module.exports = {
  registerModuleManifest,
  getModuleManifest,
  listModuleManifests,
  clearAll
};
