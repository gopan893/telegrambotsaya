'use strict';

// =============================================================
// OUTPUT SANITIZER — Phase 10 Hotfix 2
// Strips or rewrites internal debug language, memory annotations,
// and AI OS implementation details from user-facing responses.
// =============================================================

// Patterns that expose internal system state — must be cleaned
const INTERNAL_PATTERNS = [
  // More verbose internal markers
  { pattern: /\[internal\]\s*/gi, replacement: '' },
  { pattern: /\[debug\]\s*/gi, replacement: '' },
  { pattern: /\[ops\]\s*/gi, replacement: '' },
  { pattern: /\[memory\]\s*/gi, replacement: '' },
  // Direct matches
  { pattern: /\blogika\s+internal\s+saya\b/gi, replacement: 'pemikiranku' },
  { pattern: /\binternal\s+reasoning\b/gi, replacement: '' },
  { pattern: /\bdebug\b(?:\s+mode)?/gi, replacement: '' },
  { pattern: /\btrace\b(?:\s+log)?/gi, replacement: '' },
  { pattern: /^memory\s+relevan\s*:/gim, replacement: '' },
  { pattern: /\bmemory\s+relevan\s*:/gi, replacement: '' },
  { pattern: /\bai\s+os\s+context\b/gi, replacement: '' },
  { pattern: /\bcontext\s+sync\b/gi, replacement: '' },
  { pattern: /\bdetected\s+contradiction\b/gi, replacement: '' },
  { pattern: /\bmendeteksi\s+kontradiksi\b/gi, replacement: 'tadi sempat kurang tepat' },
  { pattern: /\bgunakan\s+insight\s*:/gi, replacement: '' },
  { pattern: /\bberdasarkan\s+target\s+minggu\s+ini\s+dan\s+(kondisi\s+)?deploy\s+terakhir\b/gi, replacement: '' },
  { pattern: /\bworkflow\s+terakhir\b/gi, replacement: '' },
  { pattern: /\bcontradiction\s+detected\b/gi, replacement: '' },
  { pattern: /\bops\s+context\b/gi, replacement: '' },
  { pattern: /\brelevant\s+memory\s*:/gi, replacement: '' },
  { pattern: /\bsystem\s+prompt\b/gi, replacement: '' },
];

// Phrases that signal unwanted project context in emotional replies
const PROJECT_LEAK_PATTERNS = [
  /\bdeploy\s+terakhir\b/gi,
  /\bkondisi\s+render\b/gi,
  /\bstatus\s+github\b/gi,
  /\btarget\s+minggu\s+ini\b/gi,
  /\bphase\s+\d+\b/gi,
  /\bworkflow\s+project\b/gi,
  /\bgoal\s+project\b/gi,
  /\broadmap\s+project\b/gi
];

// Admin-visible debug markers (these are intentional and should NOT be stripped for admins)
const ADMIN_MARKERS = [
  '/debug', '/system', '/ops', '/diag', '/health',
  '/benchmark', '/reliability', '/perf', '/tokens', '/cost'
];

/**
 * Check if text contains internal debug language that should not reach users.
 */
function containsInternalDebugText(text) {
  if (!text) return false;
  const t = String(text);
  return INTERNAL_PATTERNS.some(({ pattern }) => pattern.test(t))
    || PROJECT_LEAK_PATTERNS.some(p => p.test(t));
}

/**
 * Rewrite internal debug text to be user-friendly.
 * Applies pattern replacements and cleans up blank lines.
 */
function rewriteInternalDebugText(text) {
  if (!text) return text;
  let t = String(text);

  // Apply pattern rewrites
  for (const { pattern, replacement } of INTERNAL_PATTERNS) {
    t = t.replace(pattern, replacement);
  }

  // Remove project leak patterns
  for (const p of PROJECT_LEAK_PATTERNS) {
    t = t.replace(p, '');
  }

  // Clean up multiple consecutive blank lines
  t = t.replace(/\n{3,}/g, '\n\n').trim();

  return t;
}

/**
 * Determine if debug output should be exposed to this user/request.
 * Admin commands always show debug info.
 */
function shouldExposeDebug(userText, isAdmin) {
  if (!isAdmin) return false;
  const lower = String(userText || '').toLowerCase().trim();
  return ADMIN_MARKERS.some(marker => lower.startsWith(marker));
}

/**
 * Main sanitizer: remove or rewrite internal markers from AI responses.
 * options.isAdmin: if true, skip sanitization for debug commands
 * options.userText: original user message (to check if admin debug command)
 * options.forceClean: if true, always sanitize regardless of admin
 */
function sanitizeAssistantVisibleText(text, options = {}) {
  if (!text) return text;

  const { isAdmin = false, userText = '', forceClean = false } = options;

  // Skip sanitization for explicit admin debug commands (unless forced)
  if (!forceClean && isAdmin && shouldExposeDebug(userText, isAdmin)) {
    return text;
  }

  // If no internal debug text, return as-is (performance optimization)
  if (!containsInternalDebugText(text)) return text;

  return rewriteInternalDebugText(text);
}

module.exports = {
  containsInternalDebugText,
  rewriteInternalDebugText,
  shouldExposeDebug,
  sanitizeAssistantVisibleText
};
