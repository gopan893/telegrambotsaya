'use strict';

function generatePluginId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 64);
}

function formatPluginList(plugins) {
  return plugins.map(p => `[${p.enabled ? 'x' : ' '}] ${p.id} v${p.version} — ${p.name} (${p.status})`).join('\n');
}

function validateConnectorConfig(config, schema) {
  const errors = [];
  for (const [key, rules] of Object.entries(schema || {})) {
    if (rules.required && (config[key] === undefined || config[key] === null)) {
      errors.push(`Missing required field: ${key}`);
    }
    if (config[key] !== undefined && rules.type && typeof config[key] !== rules.type) {
      errors.push(`Field "${key}" type mismatch: expected ${rules.type}, got ${typeof config[key]}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function safeConnectorCall(fn, fallback = null) {
  try {
    return fn();
  } catch (err) {
    return fallback;
  }
}

module.exports = { generatePluginId, formatPluginList, validateConnectorConfig, safeConnectorCall };
