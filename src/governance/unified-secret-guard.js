'use strict';

const SECRET_PATTERNS = [
  { pattern: /\btoken\s*[:=]\s*\S+/i, label: 'TOKEN' },
  { pattern: /\bsecret\s*[:=]\s*\S+/i, label: 'SECRET' },
  { pattern: /\bpassword\s*[:=]\s*\S+/i, label: 'PASSWORD' },
  { pattern: /\bapi[_-]?key\s*[:=]\s*\S+/i, label: 'API_KEY' },
  { pattern: /\b(https?:\/\/)?[^@\s]+:[^@\s]+@[^\s]+\b/, label: 'URL_CREDENTIALS' },
  { pattern: /\b(Authorization|Bearer)\s*:\s*\S+/i, label: 'AUTH_HEADER' },
  { pattern: /\bDATABASE_URL\s*[:=]\s*\S+/i, label: 'DATABASE_URL' },
  { pattern: /\bREDIS_URL\s*[:=]\s*\S+/i, label: 'REDIS_URL' },
  { pattern: /postgresql:\/\/[^\s]+/i, label: 'POSTGRESQL_URL' },
  { pattern: /rediss?:\/\/[^\s]+/i, label: 'REDIS_URL_CONNECTION' },
  { pattern: /\bsk-\w{10,}/i, label: 'OPENAI_API_KEY' },
  { pattern: /\bghp_\w{10,}/i, label: 'GITHUB_TOKEN_OLD' },
  { pattern: /\bgithub_pat_\w{10,}/i, label: 'GITHUB_TOKEN_PAT' },
  { pattern: /\bgsk_\w{10,}/i, label: 'GROQ_API_KEY' },
  { pattern: /\btvly_\w{10,}/i, label: 'TOGETHER_API_KEY' },
  { pattern: /\bTELEGRAM_TOKEN\b/i, label: 'TELEGRAM_TOKEN_ENV' },
  { pattern: /\bGITHUB_TOKEN\b/i, label: 'GITHUB_TOKEN_ENV' },
  { pattern: /\bGOOGLE_CLIENT_SECRET\b/i, label: 'GOOGLE_CLIENT_SECRET_ENV' },
  { pattern: /\bCLOUDFLARE_API_TOKEN\b/i, label: 'CLOUDFLARE_API_TOKEN_ENV' },
  { pattern: /\bRENDER_DEPLOY_HOOK\b/i, label: 'RENDER_DEPLOY_HOOK_ENV' },
  { pattern: /\bDASHBOARD_ADMIN_TOKEN\b/i, label: 'DASHBOARD_ADMIN_TOKEN_ENV' }
];

function scanGovernancePayloadForSecrets(payload) {
  if (!payload) return { hasSecret: false, matches: [], sanitized: payload };

  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const matches = [];

  for (const { pattern, label } of SECRET_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push({
        label,
        index: match.index,
        matched: match[0].slice(0, 30) + '...'
      });
    }
  }

  return {
    hasSecret: matches.length > 0,
    matches,
    sanitized: matches.length > 0 ? redactGovernancePayload(payload) : payload
  };
}

function redactGovernancePayload(payload) {
  if (!payload) return payload;

  let text = typeof payload === 'string' ? payload : JSON.stringify(payload);

  for (const { pattern } of SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      const parts = match.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const separator = match.includes(':') ? ':' : '=';
        const prefix = match.substring(0, match.indexOf(separator) + 1);
        return prefix + ' [REDACTED_SECRET]';
      }
      return '[REDACTED_SECRET]';
    });
  }

  return text;
}

function blockSecretUnsafeAction(action, payload, module) {
  if (!payload) return { blocked: false, reason: null };

  const scan = scanGovernancePayloadForSecrets(payload);
  if (!scan.hasSecret) return { blocked: false, reason: null };

  const blockedModules = ['memory', 'knowledge', 'improvement', 'lifeos'];
  const actionLower = (action && typeof action === 'string' ? action : (action && action.name) || '').toLowerCase();

  if (blockedModules.includes(module) && scan.hasSecret) {
    return {
      blocked: true,
      reason: `Secret detected in ${module} write. Raw secret storage blocked.`,
      scan
    };
  }

  if (/github|push|deploy/.test(actionLower) && scan.hasSecret) {
    return {
      blocked: true,
      reason: 'Secret detected in GitHub/deploy proposal. Action blocked until cleaned.',
      scan
    };
  }

  return {
    blocked: false,
    reason: 'Secret detected but not in blocked context',
    scan
  };
}

function buildSecretGuardReport(result) {
  return {
    safe: !result.blocked,
    blocked: result.blocked || false,
    reason: result.reason || null,
    hasSecret: (result.scan && result.scan.hasSecret) || false,
    matchCount: (result.scan && result.scan.matches ? result.scan.matches.length : 0),
    summary: result.blocked
      ? '🛡️ Secret guard blocked this action.'
      : result.scan && result.scan.hasSecret
        ? '⚠️ Secret detected but not blocked.'
        : '✅ No secrets detected.'
  };
}

module.exports = {
  scanGovernancePayloadForSecrets,
  redactGovernancePayload,
  blockSecretUnsafeAction,
  buildSecretGuardReport,
  SECRET_PATTERNS
};
