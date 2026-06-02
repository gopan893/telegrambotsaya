'use strict';

const { maskSecret, normalizeAgentId, sanitizeMemoryText, sanitizeSummary } = require('./agent-memory-utils');

function buildToneInstructions(profile = {}) {
  const style = profile.responseStyle || {};
  const toneRules = Array.isArray(profile.toneRules) ? profile.toneRules : [];
  return [
    `Tone: ${style.tone || 'tenang, jelas, ringkas'}.`,
    `Verbosity: ${style.verbosity || 'concise'}.`,
    ...toneRules.slice(0, 8).map(rule => `- ${sanitizeMemoryText(rule, 160)}`)
  ].join('\n');
}

function buildOutputFormatInstructions(profile = {}) {
  const style = profile.responseStyle || {};
  const rules = Array.isArray(profile.outputFormatRules) ? profile.outputFormatRules : [];
  return [
    `Structure: ${style.structure || 'short_sections'}.`,
    `Max bullets: ${Number(style.maxBullets || 5)}.`,
    ...rules.slice(0, 8).map(rule => `- ${sanitizeMemoryText(rule, 180)}`)
  ].join('\n');
}

function buildSafetyInstructions(profile = {}) {
  const rules = Array.isArray(profile.safetyRules) ? profile.safetyRules : [];
  return [
    'Safety:',
    ...rules.slice(0, 12).map(rule => `- ${sanitizeMemoryText(rule, 180)}`),
    '- Jangan mengaku benar-benar sadar, memiliki kehendak bebas, atau memiliki kesadaran manusia.',
    '- Jika aksi write/external/danger diminta, buat proposal dan minta approval eksplisit.'
  ].join('\n');
}

function buildAgentStyleGuide(profile = {}) {
  return sanitizeSummary({
    agentId: normalizeAgentId(profile.agentId),
    displayName: profile.displayName,
    role: profile.role,
    personality: maskSecret(profile.personality || ''),
    toneInstructions: buildToneInstructions(profile),
    outputInstructions: buildOutputFormatInstructions(profile),
    safetyInstructions: buildSafetyInstructions(profile),
    knowledgeScope: Array.isArray(profile.knowledgeScope) ? profile.knowledgeScope.slice(0, 20) : []
  });
}

function buildTelegramStyleSummary(profile = {}) {
  const guide = buildAgentStyleGuide(profile);
  return [
    `${guide.displayName || guide.agentId}`,
    `Role: ${guide.role || '-'}`,
    `Personality: ${sanitizeMemoryText(guide.personality, 240)}`,
    '',
    guide.toneInstructions,
    '',
    guide.outputInstructions,
    '',
    `Knowledge scope: ${(guide.knowledgeScope || []).join(', ') || '-'}`
  ].join('\n');
}

module.exports = {
  buildAgentStyleGuide,
  buildOutputFormatInstructions,
  buildSafetyInstructions,
  buildTelegramStyleSummary,
  buildToneInstructions
};
