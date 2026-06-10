'use strict';

const { containsSecret } = require('./memory-intelligence-utils');
const store = require('./memory-intelligence-store');

const SENSITIVITY_LEVELS = [
  'public_project',
  'internal_project',
  'security_sensitive',
  'privacy_sensitive',
  'lifeos_private',
  'secret_blocked',
  'unknown'
];

const CLASSIFICATION_RULES = [
  {
    level: 'secret_blocked',
    test: (memory) => containsSecret(memory.content || ''),
    description: 'Contains API keys, tokens, passwords, or secrets',
    ragAction: 'block'
  },
  {
    level: 'lifeos_private',
    test: (memory) => {
      const content = (memory.content || '').toLowerCase();
      const tags = (memory.tags || []).map(t => t.toLowerCase());
      return tags.includes('lifeos') || tags.includes('personal') ||
        /\b(mood|energy|emotion|feeling|personal goal|habit|reminder|focus session)\b/i.test(content) ||
        memory.source === 'lifeos';
    },
    description: 'Private Life OS data — owner-only access',
    ragAction: 'owner_only'
  },
  {
    level: 'security_sensitive',
    test: (memory) => {
      const content = (memory.content || '').toLowerCase();
      return /\b(password|credential|auth|token|key|secret| vulnerability| exploit| breach)\b/i.test(content) ||
        (memory.tags || []).some(t => /security|credential|auth/i.test(t));
    },
    description: 'Security-sensitive content',
    ragAction: 'restrict'
  },
  {
    level: 'privacy_sensitive',
    test: (memory) => {
      const content = (memory.content || '').toLowerCase();
      return /\b(email|phone|address|ssn|id number|private data|personal info)\b/i.test(content) ||
        (memory.tags || []).some(t => /privacy|personal|pii/i.test(t));
    },
    description: 'Privacy-sensitive personal data',
    ragAction: 'restrict'
  },
  {
    level: 'internal_project',
    test: (memory) => {
      const content = (memory.content || '').toLowerCase();
      return /\b(internal|confidential|proprietary|not for distribution)\b/i.test(content) ||
        (memory.tags || []).some(t => /internal|confidential/i.test(t));
    },
    description: 'Internal project data',
    ragAction: 'internal_only'
  },
  {
    level: 'public_project',
    test: () => true,
    description: 'Public or general project data',
    ragAction: 'allow'
  }
];

function classifySensitivity(memory) {
  if (!memory || typeof memory !== 'object') {
    return {
      level: 'unknown',
      ragAction: 'block',
      description: 'Invalid memory',
      confidence: 0,
      warnings: ['invalid_memory']
    };
  }

  const warnings = [];

  for (const rule of CLASSIFICATION_RULES) {
    try {
      if (rule.test(memory)) {
        const classification = {
          level: rule.level,
          ragAction: rule.ragAction,
          description: rule.description,
          confidence: 0.8,
          warnings
        };

        store.storeSensitivityClassification(memory.id, classification);
        return classification;
      }
    } catch (err) {
      warnings.push(`rule_error:${rule.level}`);
    }
  }

  return {
    level: 'unknown',
    ragAction: 'block',
    description: 'Could not classify',
    confidence: 0,
    warnings
  };
}

function classifyBatch(memories) {
  if (!Array.isArray(memories)) return [];
  return memories.map(m => classifySensitivity(m));
}

function getSensitivityDistribution(memories) {
  const classified = classifyBatch(memories);
  const counts = {};
  for (const level of SENSITIVITY_LEVELS) {
    counts[level] = 0;
  }
  for (const c of classified) {
    counts[c.level] = (counts[c.level] || 0) + 1;
  }
  return {
    total: classified.length,
    counts,
    blockedCount: counts.secret_blocked || 0,
    ownerOnlyCount: counts.lifeos_private || 0,
    ragSafeCount: (counts.public_project || 0) + (counts.internal_project || 0)
  };
}

function shouldBlockFromRag(classification) {
  return classification && classification.ragAction === 'block';
}

function isOwnerOnly(classification) {
  return classification && classification.ragAction === 'owner_only';
}

function isRagSafe(classification) {
  return classification && (classification.ragAction === 'allow' || classification.ragAction === 'internal_only');
}

module.exports = {
  classifySensitivity,
  classifyBatch,
  getSensitivityDistribution,
  shouldBlockFromRag,
  isOwnerOnly,
  isRagSafe,
  SENSITIVITY_LEVELS,
  CLASSIFICATION_RULES
};
