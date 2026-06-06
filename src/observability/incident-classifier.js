'use strict';

const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

function classifyAffectedSystems(incident = {}) {
  const text = `${incident.title || ''} ${incident.summary || ''} ${incident.source || ''}`.toLowerCase();
  const systems = [];
  if (/dashboard|tab|ui|route|overview/.test(text)) systems.push('dashboard');
  if (/webhook|telegram|bot/.test(text)) systems.push('telegram');
  if (/postgres|database|storage|database_url/.test(text)) systems.push('storage');
  if (/redis|cache/.test(text)) systems.push('redis');
  if (/executor|approval|approve|runexec/.test(text)) systems.push('executor');
  if (/integration|github|calendar|gmail|webhook post|external/.test(text)) systems.push('integrations');
  if (/deploy|render|rollback|release/.test(text)) systems.push('deploy');
  if (/secret|token|api key|credential|leak/.test(text)) systems.push('security');
  return utils.unique(incident.affectedSystems || systems.length ? systems.concat(incident.affectedSystems || []) : ['app']);
}

function classifyIncidentSeverity(incident = {}) {
  const text = `${incident.title || ''} ${incident.summary || ''} ${incident.source || ''}`.toLowerCase();
  if (/secret|token|credential|database_url|redis_url|approval bypass|direct external write|app cannot start|startup crash/.test(text)) return 'critical';
  if (/deploy failed|production deploy broken|rollback failed|app down|unhealthy/.test(text)) return 'critical';
  if (/dashboard broken|ui is not defined|webhook broken|postgres.*disconnected|storage unavailable|integration gate broken/.test(text)) return 'high';
  if (/redis|optional connector|evaluation gate|degraded/.test(text)) return 'medium';
  if (/warning|stale cache|routine/.test(text)) return 'low';
  return utils.normalizeSeverity(incident.severity || 'info');
}

function determineIncidentPriority(incident = {}) {
  const severity = classifyIncidentSeverity(incident);
  const systems = classifyAffectedSystems(incident);
  const score = {
    critical: 100,
    high: 80,
    medium: 55,
    low: 30,
    info: 10
  }[severity] || 10;
  return {
    severity,
    priorityScore: Math.min(100, score + (systems.includes('security') ? 10 : 0)),
    affectedSystems: systems
  };
}

function buildSeverityReason(incident = {}) {
  const severity = classifyIncidentSeverity(incident);
  if (severity === 'critical') return 'Critical because startup, secret leakage, deploy, or approval boundary may be affected.';
  if (severity === 'high') return 'High because a core user-facing or production dependency appears broken.';
  if (severity === 'medium') return 'Medium because the system is degraded but fallback may still work.';
  if (severity === 'low') return 'Low because impact appears limited.';
  return 'Info-level incident for tracking and timeline context.';
}

function classifyIncident(incident = {}) {
  const priority = determineIncidentPriority(incident);
  return sanitizer.sanitize({
    ...incident,
    severity: priority.severity,
    affectedSystems: priority.affectedSystems,
    priorityScore: priority.priorityScore,
    severityReason: buildSeverityReason({ ...incident, severity: priority.severity })
  });
}

module.exports = {
  buildSeverityReason,
  classifyAffectedSystems,
  classifyIncident,
  classifyIncidentSeverity,
  determineIncidentPriority
};
