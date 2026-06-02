'use strict';

const profileStore = require('./agent-profile-store');
const preferences = require('./agent-preferences');
const memoryStore = require('./agent-memory-store');
const learningNotes = require('./agent-learning-notes');
const styleBuilder = require('./agent-style-builder');
const {
  getUserIdFromContext,
  getWorkspaceIdFromContext,
  maskSecret,
  normalizeAgentId,
  sanitizeMemoryText,
  sanitizeSummary
} = require('./agent-memory-utils');

function formatMemoryBlock(agentMemories = [], sharedMemories = []) {
  const lines = [];
  if (agentMemories.length) {
    lines.push('Agent-specific memory:');
    agentMemories.slice(0, 5).forEach(memory => {
      lines.push(`- [${memory.type}] ${sanitizeMemoryText(memory.title, 100)}: ${sanitizeMemoryText(memory.content, 260)}`);
    });
  }
  if (sharedMemories.length) {
    lines.push('Shared memory:');
    sharedMemories.slice(0, 3).forEach(memory => {
      lines.push(`- [shared] ${sanitizeMemoryText(memory.title, 100)}: ${sanitizeMemoryText(memory.content, 220)}`);
    });
  }
  return lines.length ? lines.join('\n') : 'No relevant agent memory selected.';
}

function composeAgentSystemPrompt(profile = {}, styleGuide = {}) {
  return [
    `Kamu bertindak sebagai ${profile.displayName || profile.agentId}.`,
    `Role: ${profile.role || 'agent'}.`,
    `Personality: ${sanitizeMemoryText(profile.personality || '', 320)}.`,
    '',
    styleGuide.toneInstructions || '',
    '',
    styleGuide.outputInstructions || '',
    '',
    styleGuide.safetyInstructions || ''
  ].filter(Boolean).join('\n');
}

function composeAgentContextBlock(input = {}, profile = {}, relevant = {}, noteSummary = '') {
  return [
    `Workspace: ${sanitizeMemoryText(input.workspaceId || 'default', 100)}.`,
    `User: ${sanitizeMemoryText(input.userId || '', 80) || 'unknown'}.`,
    `Topics: ${(input.topics || []).slice(0, 12).join(', ') || 'unknown'}.`,
    `Risk: ${input.riskLevel || input.risk?.level || 'low'}.`,
    '',
    formatMemoryBlock(relevant.memories || [], relevant.sharedMemories || []),
    '',
    profile.learningNotesEnabled !== false ? `Learning notes:\n${noteSummary || 'Tidak ada learning notes relevan.'}` : 'Learning notes disabled.'
  ].join('\n');
}

async function composeAgentFinalPrompt(agentId, message = '', context = {}, services = {}) {
  const cleanAgentId = normalizeAgentId(agentId);
  const workspaceId = getWorkspaceIdFromContext(context, services);
  const userId = getUserIdFromContext(context, services);
  const profile = await profileStore.getAgentProfile(cleanAgentId, { ...services, workspaceId });
  const pref = await preferences.getAgentPreferences(cleanAgentId, { ...services, workspaceId });
  const styleGuide = styleBuilder.buildAgentStyleGuide(profile);
  let relevant = { memories: [], sharedMemories: [], explanation: 'Memory disabled.' };

  if (profile.agentMemoryEnabled !== false) {
    relevant = await memoryStore.getRelevantAgentMemories(cleanAgentId, message, {
      ...context,
      workspaceId,
      userId,
      memoryPolicy: profile.memoryPolicy || {},
      maxAgentMemories: profile.memoryPolicy?.maxAgentMemories || 5,
      maxSharedMemories: profile.sharedMemoryEnabled === false ? 0 : (profile.memoryPolicy?.maxSharedMemories || 3)
    }, services);
    await memoryStore.markMemoriesUsed([...(relevant.memories || []), ...(relevant.sharedMemories || [])], services);
  }

  const noteSummary = profile.learningNotesEnabled === false
    ? ''
    : await learningNotes.summarizeLearningNotes(cleanAgentId, { workspaceId, userId, limit: 3 }, services);
  const systemPrompt = composeAgentSystemPrompt(profile, styleGuide);
  const contextBlock = composeAgentContextBlock({ ...context, workspaceId, userId }, profile, relevant, noteSummary);
  const finalPrompt = maskSecret([
    systemPrompt,
    '',
    'Context:',
    contextBlock,
    '',
    `User message:\n${sanitizeMemoryText(message, 1800)}`,
    '',
    'Jawab sebagai agent role di atas. Pakai memory hanya bila relevan, jangan expose internal hidden reasoning.'
  ].join('\n'));

  return sanitizeSummary({
    agentId: cleanAgentId,
    workspaceId,
    userId,
    profile,
    preferences: pref.preferences || {},
    styleGuide,
    selectedMemories: relevant.memories || [],
    sharedMemories: relevant.sharedMemories || [],
    memoryExplanation: relevant.explanation || '',
    systemPrompt,
    contextBlock,
    finalPrompt,
    promptPreview: sanitizeMemoryText(finalPrompt, 1200)
  });
}

module.exports = {
  composeAgentContextBlock,
  composeAgentFinalPrompt,
  composeAgentSystemPrompt,
  formatMemoryBlock
};
