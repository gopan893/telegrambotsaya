'use strict';

function interpolate(template, variables) {
  if (typeof template === 'string') {
    return template.replace(/\$(\w+)/g, (match, key) => {
      if (variables[key] !== undefined && variables[key] !== null) return String(variables[key]);
      const nested = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), variables);
      return nested !== undefined ? String(nested) : match;
    });
  }
  if (Array.isArray(template)) {
    return template.map(item => interpolate(item, variables));
  }
  if (template && typeof template === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = interpolate(value, variables);
    }
    return result;
  }
  return template;
}

function resolveVariablePath(path, context) {
  const parts = String(path).split('.');
  let val = context;
  for (const part of parts) {
    if (val === null || val === undefined) return undefined;
    val = val[part];
  }
  return val;
}

function buildVariableContext(globalVars, localVars) {
  return { ...globalVars, ...localVars };
}

module.exports = { interpolate, resolveVariablePath, buildVariableContext };
