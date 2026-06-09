'use strict';

const utils = require('./research-utils');

function createResearchNotes(taskId, sources = [], services = {}) {
  return {
    taskId,
    notes: sources.map(s => ({
      sourceId: s.id,
      summary: utils.sanitizeText(`Catatan dari ${s.title || 'sumber'}`, 1000),
      keyFacts: extractKeyFacts(s, services),
      openQuestions: extractOpenQuestions(s, services),
      implementationConstraints: extractImplementationConstraints(s, services)
    })),
    createdAt: new Date().toISOString()
  };
}

function summarizeSourceNotes(notes = [], services = {}) {
  if (!notes.length) return 'Belum ada catatan.';
  return notes.map(n => {
    const facts = n.keyFacts?.length ? n.keyFacts.slice(0, 3).join('; ') : 'Tidak ada fakta kunci';
    return `- ${n.summary || 'Ringkasan'}: ${facts}`;
  }).join('\n');
}

function extractKeyFacts(source, services = {}) {
  const text = `${source.title || ''} ${source.notes || ''}`;
  const facts = [];
  if (text.length > 10) facts.push(utils.sanitizeText(`Informasi dari: ${source.title || 'sumber'}`, 300));
  if (source.trustLevel === 'high') facts.push(`Sumber terpercaya: ${source.title || 'unknown'}`);
  return facts.length ? facts : ['Belum ada fakta terekstrak.'];
}

function extractOpenQuestions(source, services = {}) {
  const questions = [];
  if (source.freshness === 'low') questions.push(`Kesegaran sumber "${source.title || 'unknown'}" rendah — mungkin perlu update.`);
  if (source.trustLevel === 'unknown') questions.push(`Tingkat kepercayaan sumber "${source.title || 'unknown'}" tidak diketahui.`);
  return questions.length ? questions : ['Tidak ada pertanyaan terbuka.'];
}

function extractImplementationConstraints(source, services = {}) {
  const constraints = [];
  if (source.accessMode === 'external') constraints.push('Sumber eksternal — akses baca-saja.');
  if (source.trustLevel === 'low') constraints.push(`Kepercayaan rendah pada ${source.title || 'sumber'} — verifikasi silang diperlukan.`);
  return constraints;
}

module.exports = { createResearchNotes, summarizeSourceNotes, extractKeyFacts, extractOpenQuestions, extractImplementationConstraints };
