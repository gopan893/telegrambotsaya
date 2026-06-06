'use strict';

const SECRET_PATTERNS = [
  /token\s*[:=]\s*\S+/gi, /secret\s*[:=]\s*\S+/gi, /password\s*[:=]\s*\S+/gi,
  /api_key\s*[:=]\s*\S+/gi, /Authorization\s*[:=]\s*\S+/gi, /Bearer\s+\S+/gi,
  /DATABASE_URL\s*[:=]\s*\S+/gi, /REDIS_URL\s*[:=]\s*\S+/gi,
  /sk-\S+/g, /ghp_\S+/g, /github_pat_\S+/g, /gsk_\S+/g, /tvly_\S+/g,
  /TELEGRAM_TOKEN\s*[:=]\s*\S+/gi, /GITHUB_TOKEN\s*[:=]\s*\S+/gi,
  /GOOGLE_CLIENT_SECRET\s*[:=]\s*\S+/gi, /CLOUDFLARE_API_TOKEN\s*[:=]\s*\S+/gi,
  /RENDER_DEPLOY_HOOK\s*[:=]\s*\S+/gi, /postgresql:\/\/\S+/gi, /rediss:\/\/\S+/gi
];

function sanitizeForReport(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (['secret', 'token', 'password', 'api_key', 'authorization'].some(k => keyLower.includes(k))) {
      safe[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      let sanitized = value;
      for (const pat of SECRET_PATTERNS) {
        sanitized = sanitized.replace(pat, '[REDACTED]');
      }
      safe[key] = sanitized;
    } else if (typeof value === 'object' && value !== null) {
      safe[key] = sanitizeForReport(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function formatGoalStatus(status) {
  const map = {
    idea: '💡 Idea', planned: '📋 Planned', in_progress: '🔧 In Progress',
    blocked: '🚫 Blocked', reviewing: '🔍 Reviewing', ready_to_ship: '✅ Ready to Ship',
    shipped: '🚀 Shipped', archived: '🗄️ Archived'
  };
  return map[status] || status || 'Unknown';
}

function formatPriority(p) {
  const map = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  return map[p] || p || 'Medium';
}

function formatRiskLevel(r) {
  const map = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  return map[r] || r || 'Low';
}

module.exports = {
  sanitizeForReport,
  formatGoalStatus,
  formatPriority,
  formatRiskLevel
};
