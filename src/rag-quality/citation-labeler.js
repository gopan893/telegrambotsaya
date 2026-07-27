'use strict';

const { truncateText, generateId } = require('./rag-quality-utils');
const store = require('./rag-quality-store');

function labelSource(source) {
  if (!source || typeof source !== 'object') {
    return { label: 'Unknown Source', citationKey: null, warnings: ['invalid_source'] };
  }

  const warnings = [];
  const parts = [];

  if (source.author) parts.push(source.author);
  if (source.title) parts.push(source.title);
  else if (source.name) parts.push(source.name);

  if (source.date || source.publishedAt || source.createdAt) {
    const date = new Date(source.date || source.publishedAt || source.createdAt);
    if (!isNaN(date.getTime())) {
      parts.push(date.getFullYear().toString());
    }
  }

  const label = parts.length > 0 ? parts.join(', ') : 'Untitled Source';

  const citationKey = generateCitationKey(source);

  const confidence = source.confidence || source.confidenceScore?.level || 'unknown';
  const freshness = source.freshness || 'unknown';

  const citationLabel = {
    sourceId: source.id || source.sourceId,
    label: truncateText(label, 120),
    citationKey,
    confidence,
    freshness,
    type: source.type || source.sourceType || 'text',
    abbreviated: generateAbbreviatedLabel(source),
    fullCitation: generateFullCitation(source),
    warnings
  };

  store.storeCitationLabel(source.id || source.sourceId, citationLabel);
  return citationLabel;
}

function generateCitationKey(source) {
  const author = (source.author || 'anon').replace(/\s+/g, '').slice(0, 8).toLowerCase();
  const year = (source.date || source.publishedAt || source.createdAt || '').slice(0, 4) || 'nd';
  const titleWord = (source.title || source.name || 'untitled').split(/\s+/)[0] || 'untitled';
  const titleClean = titleWord.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
  return `(${author}${year}${titleClean})`;
}

function generateAbbreviatedLabel(source) {
  const authorLast = (source.author || 'Unknown').split(/\s+/).pop() || 'Unknown';
  const year = (source.date || source.publishedAt || source.createdAt || '').slice(0, 4) || 'n.d.';
  return `${authorLast} (${year})`;
}

function generateFullCitation(source) {
  const parts = [];
  if (source.author) parts.push(source.author);
  if (source.date || source.publishedAt) {
    const date = new Date(source.date || source.publishedAt);
    if (!isNaN(date.getTime())) parts.push(`(${date.getFullYear()})`);
  }
  if (source.title) parts.push(source.title);
  if (source.source) parts.push(source.source);
  if (source.url) parts.push(source.url);
  return parts.join('. ') || 'Unknown source';
}

function labelBatch(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map(s => labelSource(s));
}

function generateInlineCitation(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return '';
  return labels.map(l => l.citationKey || '[?]').join('; ');
}

function formatReferenceList(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return '';
  return labels.map((l, i) => `${i + 1}. ${l.fullCitation || l.label}`).join('\n');
}

module.exports = { labelSource, labelBatch, generateInlineCitation, formatReferenceList, generateCitationKey };
