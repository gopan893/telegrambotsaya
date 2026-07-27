'use strict';

const validator = require('./plugin-validator');

function parseManifest(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Manifest must be an object' };
  const manifest = {
    id: String(raw.id || '').trim(),
    name: String(raw.name || '').trim(),
    version: String(raw.version || '').trim(),
    main: String(raw.main || '').trim(),
    type: String(raw.type || 'module').trim(),
    description: String(raw.description || '').trim(),
    author: String(raw.author || '').trim(),
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map(String) : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    config: raw.config && typeof raw.config === 'object' ? { ...raw.config } : {},
    minAppVersion: String(raw.minAppVersion || '').trim(),
    maxAppVersion: String(raw.maxAppVersion || '').trim(),
    icon: String(raw.icon || '').trim(),
    homepage: String(raw.homepage || '').trim(),
    repository: String(raw.repository || '').trim(),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : []
  };
  const validation = validator.validatePluginManifest(manifest);
  if (!validation.valid) return { ok: false, errors: validation.errors };
  return { ok: true, manifest };
}

function serializeManifest(plugin) {
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    main: plugin.main,
    type: plugin.type || 'module',
    description: plugin.description || '',
    author: plugin.author || '',
    dependencies: plugin.dependencies || [],
    permissions: plugin.permissions || [],
    config: plugin.config || {},
    minAppVersion: plugin.minAppVersion || '',
    maxAppVersion: plugin.maxAppVersion || '',
    icon: plugin.icon || '',
    homepage: plugin.homepage || '',
    repository: plugin.repository || '',
    keywords: plugin.keywords || []
  };
}

module.exports = { parseManifest, serializeManifest };
