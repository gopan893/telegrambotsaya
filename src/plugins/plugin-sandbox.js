'use strict';

const ALLOWED_GLOBALS = ['console', 'Buffer', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Promise', 'Math', 'Date', 'JSON', 'RegExp', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Map', 'Set', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent'];

function createSandboxContext(pluginId, api) {
  return {
    pluginId,
    api: { ...api, log: (...args) => console.log(`[plugin:${pluginId}]`, ...args) },
    __allowedGlobals: ALLOWED_GLOBALS
  };
}

function validateSandboxAccess(context, resource) {
  if (!context || !context.api) return { allowed: false, reason: 'No sandbox context' };
  const allowedResources = context.api.allowedResources || [];
  if (allowedResources.includes('*')) return { allowed: true };
  if (allowedResources.includes(resource)) return { allowed: true };
  return { allowed: false, reason: `Resource "${resource}" not in allowed list` };
}

function isPathAllowed(requestedPath, allowedPaths) {
  if (allowedPaths.includes('*')) return true;
  return allowedPaths.some(p => requestedPath.startsWith(p));
}

module.exports = { createSandboxContext, validateSandboxAccess, isPathAllowed };
