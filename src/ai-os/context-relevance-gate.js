'use strict';

// =============================================================
// CONTEXT RELEVANCE GATE — Phase 10 Hotfix 2
// Prevents project/coding/deploy memory from leaking into
// emotional or relationship conversations.
// =============================================================

const DOMAIN = {
  PROJECT: 'project',
  CODING: 'coding',
  OPS: 'ops',
  LEARNING: 'learning',
  STRATEGY: 'strategy',
  RELATIONSHIP: 'relationship',
  EMOTIONAL: 'emotional',
  HEALTH: 'health',
  GENERAL: 'general'
};

// Keywords that signal emotional / relationship domain
const EMOTIONAL_KW = [
  'pacar', 'putus', 'hubungan', 'cinta', 'rindu', 'sedih', 'sakit hati',
  'berat menerima', 'move on', 'kehilangan', 'perasaan', 'kecewa',
  'menangis', 'galau', 'ditinggal', 'patah hati', 'kesepian', 'lonely',
  'broken heart', 'heartbreak', 'galau', 'ingin menangis', 'mau nangis',
  'baper', 'terluka', 'luka', 'rasa sakit', 'menyakitkan', 'hancur',
  'depresi', 'stres berat', 'nangis', 'ingin menyerah', 'susah move on',
  'kenangan buruk', 'trauma', 'merana', 'pilu', 'nelangsa'
];

// Keywords that signal project / coding domain
const PROJECT_KW = [
  'project', 'bot', 'coding', 'kode', 'deploy', 'render', 'github',
  'database', 'phase', 'tahap', 'workflow', 'goal project', 'roadmap project',
  'ai os', 'api', 'server', 'bug', 'error', 'function', 'module', 'file',
  'commit', 'push', 'pull request', 'repository', 'repo', 'npm', 'node',
  'javascript', 'typescript', 'python', 'backend', 'frontend', 'endpoint',
  'webhook', 'token api', 'environment', 'env', 'variable', 'config',
  'database', 'postgresql', 'redis', 'mongodb', 'sql', 'query', 'migration',
  'testing', 'test', 'unit test', 'production', 'staging', 'cicd', 'docker',
  'container', 'devops', 'debug', 'log', 'feature', 'release', 'version'
];

// Health keywords
const HEALTH_KW = [
  'sakit', 'pusing', 'demam', 'mual', 'nyeri', 'lelah', 'capek', 'tidak enak badan',
  'flu', 'batuk', 'pilek', 'sesak', 'migrain', 'penyakit', 'dokter', 'obat',
  'gejala', 'kesehatan', 'istirahat', 'tidur', 'imun', 'vitamin'
];

// Memory types that must NOT be included in emotional conversations
const PROJECT_MEMORY_TYPES = new Set([
  'project', 'workflow', 'goal', 'coding', 'deploy', 'technical',
  'ops', 'system', 'api', 'database', 'server', 'debug', 'feature',
  'repository', 'commit', 'release', 'config', 'environment'
]);

// Memory content patterns that indicate project context
const PROJECT_CONTENT_PATTERNS = [
  /\b(deploy|render|github|database|workflow|project|phase|roadmap|api|server|bug|error)\b/i,
  /\b(postgresql|redis|mongodb|npm|node\.js|javascript|python)\b/i,
  /\b(commit|push|pull request|repository|staging|production)\b/i
];

function normalizeText(text) {
  return String(text || '').toLowerCase().trim();
}

/**
 * Detect conversation domain from user text and optional recent context.
 * Returns the most likely domain string.
 */
function detectConversationDomain(text, recentContext) {
  const norm = normalizeText(text);

  // Check project keywords first (explicit technical mention overrides emotional)
  const hasProjectKw = PROJECT_KW.some(kw => norm.includes(kw.toLowerCase()));

  // Check emotional keywords
  const hasEmotionalKw = EMOTIONAL_KW.some(kw => norm.includes(kw.toLowerCase()));

  // Check health
  const hasHealthKw = HEALTH_KW.some(kw => norm.includes(kw.toLowerCase()));

  // If explicitly technical, always project
  if (hasProjectKw && !hasEmotionalKw) return DOMAIN.PROJECT;

  // Emotional/relationship
  if (hasEmotionalKw) return DOMAIN.EMOTIONAL;

  // Health
  if (hasHealthKw) return DOMAIN.HEALTH;

  // Context carries emotional signals from recent messages
  if (recentContext) {
    const ctxNorm = normalizeText(
      Array.isArray(recentContext)
        ? recentContext.map(m => m.text || m.content || '').join(' ')
        : String(recentContext)
    );
    if (EMOTIONAL_KW.some(kw => ctxNorm.includes(kw.toLowerCase()))) return DOMAIN.EMOTIONAL;
    if (PROJECT_KW.some(kw => ctxNorm.includes(kw.toLowerCase())) && hasProjectKw) return DOMAIN.PROJECT;
  }

  // General fallback
  return DOMAIN.GENERAL;
}

/**
 * Score relevance of a memory item for a user message.
 * Returns 0.0 (not relevant) to 1.0 (very relevant).
 */
function scoreContextRelevance(userText, memoryItem) {
  if (!memoryItem) return 0;
  const domain = detectConversationDomain(userText, null);
  const content = normalizeText(memoryItem.content || memoryItem.text || memoryItem.summary || '');
  const memType = normalizeText(memoryItem.type || memoryItem.category || '');

  // For emotional domain: project memories score 0
  if (domain === DOMAIN.EMOTIONAL || domain === DOMAIN.RELATIONSHIP) {
    if (PROJECT_MEMORY_TYPES.has(memType)) return 0;
    if (PROJECT_CONTENT_PATTERNS.some(p => p.test(content))) return 0;
    // Emotional/reflective memories are relevant
    if (['emotional', 'reflective', 'insight', 'personal'].includes(memType)) return 0.8;
    return 0.3;
  }

  // For project domain: project memories score high
  if (domain === DOMAIN.PROJECT || domain === DOMAIN.CODING) {
    if (PROJECT_MEMORY_TYPES.has(memType)) return 0.9;
    if (PROJECT_CONTENT_PATTERNS.some(p => p.test(content))) return 0.75;
    return 0.2;
  }

  // General: moderate relevance
  return 0.5;
}

/**
 * Filter a list of context/memory items based on user text and domain.
 * Returns only relevant context items.
 */
function filterRelevantContext(userText, context, options = {}) {
  if (!Array.isArray(context)) return [];

  const domain = detectConversationDomain(userText, null);
  const minScore = Number(options.minScore || 0.2);

  // For emotional domain, exclude project memories entirely
  if (domain === DOMAIN.EMOTIONAL || domain === DOMAIN.RELATIONSHIP) {
    return context.filter(item => {
      const memType = normalizeText(item.type || item.category || '');
      const content = normalizeText(item.content || item.text || item.summary || '');

      // Hard block: project memory types
      if (PROJECT_MEMORY_TYPES.has(memType)) return false;

      // Hard block: project content patterns
      if (PROJECT_CONTENT_PATTERNS.some(p => p.test(content))) return false;

      // Only allow emotional/personal/insight memories
      const score = scoreContextRelevance(userText, item);
      return score >= minScore;
    });
  }

  // For other domains, apply soft scoring
  return context.filter(item => {
    const score = scoreContextRelevance(userText, item);
    return score >= minScore;
  });
}

/**
 * Determine if project context should be included for this message.
 */
function shouldUseProjectContext(userText, adaptiveResult) {
  const norm = normalizeText(userText);
  const hasProjectKw = PROJECT_KW.some(kw => norm.includes(kw.toLowerCase()));
  const hasEmotionalKw = EMOTIONAL_KW.some(kw => norm.includes(kw.toLowerCase()));

  // Emotional override — no project context
  if (hasEmotionalKw && !hasProjectKw) return false;

  // If adaptive result signals emotional mode, skip project context
  if (adaptiveResult && adaptiveResult.mode === 'emotional') return false;

  return hasProjectKw;
}

/**
 * Determine if emotional support routing should be activated.
 */
function shouldUseEmotionalSupport(userText, adaptiveResult) {
  const norm = normalizeText(userText);
  const hasEmotionalKw = EMOTIONAL_KW.some(kw => norm.includes(kw.toLowerCase()));
  const hasProjectKw = PROJECT_KW.some(kw => norm.includes(kw.toLowerCase()));

  // Emotional support when emotional keywords present and no explicit project context
  if (hasEmotionalKw && !hasProjectKw) return true;

  // Adaptive mode override
  if (adaptiveResult && adaptiveResult.mode === 'emotional') return true;

  return false;
}

/**
 * Build the emotional support system prompt.
 */
function buildEmotionalSupportPrompt() {
  return `Kamu adalah asisten yang suportif, tenang, tidak menghakimi, dan membantu user berpikir jernih. Jangan menggurui. Jangan memakai konteks project/coding kecuali user menyebutkannya secara langsung. Beri langkah kecil yang realistis. Jangan membuat diagnosis psikologis. Fokus pada perasaan user sekarang, validasi apa yang dirasakan, dan tawarkan perspektif yang menenangkan. Jika user menunjukkan tanda ingin menyakiti diri, sarankan segera mencari bantuan orang terdekat atau layanan darurat seperti Into The Light Indonesia (119 ext 8).`;
}

module.exports = {
  DOMAIN,
  detectConversationDomain,
  scoreContextRelevance,
  filterRelevantContext,
  shouldUseProjectContext,
  shouldUseEmotionalSupport,
  buildEmotionalSupportPrompt
};
