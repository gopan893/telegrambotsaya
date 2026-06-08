'use strict';

const crypto = require('crypto');

const SECRET_PATTERNS = [
  { pattern: /\bTELEGRAM_TOKEN\b/i, label: 'TELEGRAM_TOKEN_ENV', severity: 'critical' },
  { pattern: /\bGITHUB_TOKEN\b/i, label: 'GITHUB_TOKEN_ENV', severity: 'critical' },
  { pattern: /\bghp_\w{10,}/i, label: 'GITHUB_TOKEN_OLD', severity: 'critical' },
  { pattern: /\bgithub_pat_\w{10,}/i, label: 'GITHUB_TOKEN_PAT', severity: 'critical' },
  { pattern: /\bDATABASE_URL\b/i, label: 'DATABASE_URL_ENV', severity: 'critical' },
  { pattern: /postgresql:\/\/[^\s"']+/i, label: 'POSTGRESQL_URL', severity: 'critical' },
  { pattern: /\bREDIS_URL\b/i, label: 'REDIS_URL_ENV', severity: 'critical' },
  { pattern: /rediss?:\/\/[^\s"']+/i, label: 'REDIS_URL_CONNECTION', severity: 'critical' },
  { pattern: /password\s*[:=]\s*\S+/i, label: 'PASSWORD_VALUE', severity: 'high' },
  { pattern: /secret\s*[:=]\s*\S+/i, label: 'SECRET_VALUE', severity: 'high' },
  { pattern: /\bsk-\w{10,}/i, label: 'OPENAI_API_KEY', severity: 'critical' },
  { pattern: /\bgsk_\w{10,}/i, label: 'GROQ_API_KEY', severity: 'critical' },
  { pattern: /\btvly_\w{10,}/i, label: 'TAVILY_API_KEY', severity: 'critical' },
  { pattern: /\bGOOGLE_CLIENT_SECRET\b/i, label: 'GOOGLE_CLIENT_SECRET_ENV', severity: 'critical' },
  { pattern: /\bCLOUDFLARE_API_TOKEN\b/i, label: 'CLOUDFLARE_API_TOKEN_ENV', severity: 'critical' },
  { pattern: /\bRENDER_API_KEY\b/i, label: 'RENDER_API_KEY_ENV', severity: 'critical' },
  { pattern: /\bRENDER_DEPLOY_HOOK\b/i, label: 'RENDER_DEPLOY_HOOK_ENV', severity: 'critical' },
  { pattern: /\bDASHBOARD_ADMIN_TOKEN\b/i, label: 'DASHBOARD_ADMIN_TOKEN_ENV', severity: 'critical' },
  { pattern: /\bapi[_-]?key\s*[:=]\s*\S+/i, label: 'API_KEY_VALUE', severity: 'high' },
  { pattern: /\btoken\s*[:=]\s*\S+/i, label: 'TOKEN_VALUE', severity: 'high' },
  { pattern: /\bBearer\s+\S+/i, label: 'BEARER_TOKEN', severity: 'high' },
  { pattern: /\bAuthorization\s*[:=]\s*\S+/i, label: 'AUTH_HEADER', severity: 'high' },
  { pattern: /\bGEMINI_API_KEY\b/i, label: 'GEMINI_API_KEY_ENV', severity: 'critical' },
  { pattern: /\bOPENAI_API_KEY\b/i, label: 'OPENAI_API_KEY_ENV', severity: 'critical' },
  { pattern: /\bGROQ_API_KEY\b/i, label: 'GROQ_API_KEY_ENV', severity: 'critical' },
  { pattern: /\bMISTRAL_API_KEY\b/i, label: 'MISTRAL_API_KEY_ENV', severity: 'critical' },
  { pattern: /\bTAVILY_API_KEY\b/i, label: 'TAVILY_API_KEY_ENV', severity: 'critical' },
  { pattern: /\bOPENWEATHER_API_KEY\b/i, label: 'OPENWEATHER_API_KEY_ENV', severity: 'critical' }
];

function scanTextForSecrets(text, surface, location) {
  if (!text) return [];
  const findings = [];
  const strText = typeof text === 'string' ? text : JSON.stringify(text);

  for (const { pattern, label, severity } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags + 'g');
    let match;
    while ((match = regex.exec(strText)) !== null) {
      const redacted = match[0].length > 6
        ? match[0].slice(0, 3) + '****' + match[0].slice(-3)
        : '****';
      findings.push({
        id: null,
        surface: surface || 'unknown',
        location: location || '',
        secretType: label,
        severity,
        confidence: severity === 'critical' ? 0.95 : 0.75,
        redactedSample: redacted,
        recommendedAction: 'rotate_and_remove',
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
  }

  return findings;
}

function findSecretsInObject(obj, surface, path) {
  if (!obj || typeof obj !== 'object') return scanTextForSecrets(String(obj), surface, path);
  const findings = [];
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof value === 'string') {
      findings.push(...scanTextForSecrets(value, surface, currentPath));
    } else if (typeof value === 'object' && value !== null) {
      findings.push(...findSecretsInObject(value, surface, currentPath));
    }
  }
  return findings;
}

function scanDashboardOutputsForSecrets(services) {
  return [];
}

function scanAuditLogsForSecrets(services) {
  try {
    const govAudit = services.governanceAudit;
    if (!govAudit || typeof govAudit.listAuditEvents !== 'function') return [];
    const events = govAudit.listAuditEvents({ limit: 200 });
    return findSecretsInObject(events, 'audit_log', 'governance_audit');
  } catch (e) {
    return [{ surface: 'audit_log', location: 'governance_audit', secretType: 'SCAN_ERROR', severity: 'info', confidence: 0, redactedSample: 'scan degraded', recommendedAction: 'check_audit_access', status: 'open', createdAt: new Date().toISOString() }];
  }
}

function scanKnowledgeGraphForSecrets(services) {
  return [];
}

function scanMemoryForSecrets(services) {
  return [];
}

function scanExecutorProposalsForSecrets(services) {
  return [];
}

function scanDocsForAccidentalSecrets(services) {
  return [];
}

function scanTelegramRecentOutputsForSecrets(services) {
  return [];
}

function scanIncidentReportsForSecrets(services) {
  return [];
}

function scanDeployReportsForSecrets(services) {
  return [];
}

function buildSecretSurfaceScanReport(results) {
  const allFindings = results.flat();
  const bySurface = {};
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const f of allFindings) {
    if (!bySurface[f.surface]) bySurface[f.surface] = [];
    bySurface[f.surface].push(f);
    if (bySeverity[f.severity] !== undefined) bySeverity[f.severity]++;
  }

  return {
    totalFindings: allFindings.length,
    totalCritical: bySeverity.critical,
    totalHigh: bySeverity.high,
    bySurface: Object.keys(bySurface).map(s => ({ surface: s, count: bySurface[s].length })),
    bySeverity,
    findings: allFindings.map(f => ({
      surface: f.surface,
      location: f.location,
      secretType: f.secretType,
      severity: f.severity,
      confidence: f.confidence,
      redactedSample: f.redactedSample,
      status: f.status
    }))
  };
}

function scanSecretSurfaces(scope, services) {
  const results = [];
  results.push(...scanDashboardOutputsForSecrets(services));
  results.push(...scanAuditLogsForSecrets(services));
  results.push(...scanMemoryForSecrets(services));
  results.push(...scanExecutorProposalsForSecrets(services));
  results.push(...scanDocsForAccidentalSecrets(services));
  return results;
}

module.exports = {
  SECRET_PATTERNS,
  scanTextForSecrets,
  findSecretsInObject,
  scanSecretSurfaces,
  scanDashboardOutputsForSecrets,
  scanAuditLogsForSecrets,
  scanKnowledgeGraphForSecrets,
  scanMemoryForSecrets,
  scanExecutorProposalsForSecrets,
  scanDocsForAccidentalSecrets,
  scanTelegramRecentOutputsForSecrets,
  scanIncidentReportsForSecrets,
  scanDeployReportsForSecrets,
  buildSecretSurfaceScanReport
};
