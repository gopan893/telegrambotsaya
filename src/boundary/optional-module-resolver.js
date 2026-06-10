'use strict';

const utils = require('./module-boundary-utils');

function safeRequireOptional(modulePath, fallback, services) {
  try {
    const mod = require(modulePath);
    return mod;
  } catch (err) {
    return fallback !== undefined ? fallback : null;
  }
}

function resolveOptionalModule(moduleName, services) {
  const path = moduleName.startsWith('.') || moduleName.startsWith('/') ? moduleName : moduleName;
  try {
    const mod = require(path);
    return { resolved: true, module: moduleName, error: null };
  } catch (err) {
    return { resolved: false, module: moduleName, error: 'module not available' };
  }
}

function buildOptionalModuleFallback(moduleName, reason, services) {
  return {
    module: moduleName,
    fallback: true,
    reason: reason || 'optional module not available, using fallback',
    degraded: true,
    timestamp: new Date().toISOString()
  };
}

function detectUnsafeRequiredOptionalModules(services) {
  const registry = require('./module-manifest-registry');
  const all = registry.listModuleManifests({}, services);
  const unsafe = [];
  for (const m of all) {
    if (m.optionalDependencies && m.optionalDependencies.length > 0) {
      for (const dep of m.optionalDependencies) {
        try {
          const resolved = resolveOptionalModule(dep, services);
          if (!resolved.resolved) {
            unsafe.push({
              module: m.module,
              optionalDependency: dep,
              issue: 'optional dependency not resolved but module tries to require it directly'
            });
          }
        } catch (e) {
          unsafe.push({
            module: m.module,
            optionalDependency: dep,
            issue: 'error checking optional dependency'
          });
        }
      }
    }
  }
  return unsafe;
}

module.exports = {
  safeRequireOptional,
  resolveOptionalModule,
  buildOptionalModuleFallback,
  detectUnsafeRequiredOptionalModules
};
