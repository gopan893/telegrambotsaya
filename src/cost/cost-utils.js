'use strict';

function formatCost(cost) {
  if (cost === null || cost === undefined || cost === 'unknown') return 'unknown';
  if (typeof cost !== 'number') return String(cost);
  if (cost < 0.0001) return '$' + cost.toExponential(2);
  if (cost < 1) return '$' + cost.toFixed(6);
  if (cost < 100) return '$' + cost.toFixed(4);
  return '$' + cost.toFixed(2);
}

function formatTokens(tokens) {
  if (typeof tokens !== 'number' || isNaN(tokens)) return '0';
  if (tokens < 1000) return String(tokens);
  if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
  return (tokens / 1000000).toFixed(2) + 'M';
}

function formatPercentage(pct) {
  if (typeof pct !== 'number' || isNaN(pct)) return '0%';
  return Math.round(pct) + '%';
}

function sanitizeForLogging(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password') || key.toLowerCase().includes('authorization')) {
      safe[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      const secretPatterns = [/sk-\S+/, /ghp_\S+/, /github_pat_\S+/, /Bearer\s+\S+/, /postgresql:\/\/\S+/, /rediss:\/\/\S+/];
      let sanitized = value;
      for (const pat of secretPatterns) {
        sanitized = sanitized.replace(pat, '[REDACTED]');
      }
      safe[key] = sanitized;
    } else if (typeof value === 'object' && value !== null) {
      safe[key] = sanitizeForLogging(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function getModeDisplay(mode) {
  const modes = {
    economy: { label: 'Economy', icon: '💰', description: 'Prioritizes low cost' },
    balanced: { label: 'Balanced', icon: '⚖️', description: 'Balances cost and quality' },
    quality: { label: 'Quality', icon: '🎯', description: 'Prioritizes quality' },
    local_first: { label: 'Local First', icon: '💻', description: 'Prefers local models' },
    manual: { label: 'Manual', icon: '✋', description: 'Manual model selection' }
  };
  return modes[mode] || { label: mode || 'Unknown', icon: '❓', description: '' };
}

module.exports = {
  formatCost,
  formatTokens,
  formatPercentage,
  sanitizeForLogging,
  getModeDisplay
};
