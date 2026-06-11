'use strict';

const { redactSecrets } = require('./telegram-markdown-sanitizer');

const MAX_CODE_LENGTH = 2000;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{10,}/g,
  /ghp_[A-Za-z0-9]{10,}/g,
  /github_pat_[A-Za-z0-9_]{10,}/g,
  /api[_-]?key['"]?\s*[:=]\s*['"]?\S+/gi,
  /token['"]?\s*[:=]\s*['"]?\S+/gi,
  /secret['"]?\s*[:=]\s*['"]?\S+/gi,
  /password['"]?\s*[:=]\s*['"]?\S+/gi,
  /Bearer\s+[A-Za-z0-9._-]{10,}/gi
];

function formatCodeBlock(code, language) {
  if (!code) return '';
  let safe = redactSecrets(String(code));
  safe = trimHugeCodeBlock(safe, MAX_CODE_LENGTH);
  const lang = language ? String(language).trim() : '';
  return '```' + lang + '\n' + safe + '\n```';
}

function formatShellCommandBlock(command) {
  if (!command) return '';
  let safe = String(command);
  for (const pattern of SECRET_PATTERNS) {
    safe = safe.replace(pattern, '[REDACTED]');
  }
  safe = trimHugeCodeBlock(safe, MAX_CODE_LENGTH);
  return '```bash\n' + safe + '\n```';
}

function formatJsonBlock(obj) {
  try {
    const str = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
    let safe = redactSecrets(str);
    safe = trimHugeCodeBlock(safe, MAX_CODE_LENGTH);
    return '```json\n' + safe + '\n```';
  } catch (_) {
    return '```\n' + String(obj) + '\n```';
  }
}

function formatDiffBlock(diff) {
  if (!diff) return '';
  let safe = redactSecrets(String(diff));
  const maxLines = 40;
  const lines = safe.split('\n');
  if (lines.length > maxLines) {
    const summary = '\n... (+' + (lines.length - maxLines) + ' lines truncated)';
    safe = lines.slice(0, maxLines).join('\n') + summary;
  }
  safe = trimHugeCodeBlock(safe, MAX_CODE_LENGTH);
  return '```diff\n' + safe + '\n```';
}

function trimHugeCodeBlock(code, maxLength) {
  if (!code) return '';
  if (code.length <= maxLength) return code;
  const half = Math.floor((maxLength - 50) / 2);
  const start = code.slice(0, half);
  const end = code.slice(code.length - half);
  return start + '\n... [truncated ' + (code.length - half * 2) + ' chars] ...\n' + end;
}

module.exports = {
  formatCodeBlock,
  formatDiffBlock,
  formatJsonBlock,
  formatShellCommandBlock,
  trimHugeCodeBlock
};
