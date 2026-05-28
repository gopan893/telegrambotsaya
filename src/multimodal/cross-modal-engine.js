'use strict';

const observability = require('../agents/observability');
const { scoreTextRelevance } = require('./file-handler');

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function normalizeList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function rankFileContexts(query, fileContexts = []) {
  return fileContexts
    .filter(Boolean)
    .map((ctx) => {
      const searchable = [
        ctx.fileName,
        ctx.contentType,
        ctx.primaryContent,
        ...(ctx.keyPoints || []),
        ...(ctx.semanticTags || [])
      ].join('\n');
      return {
        context: ctx,
        relevance: scoreTextRelevance(query, searchable)
      };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

function buildCrossModalContext(traceId, query, textContext = {}, fileContexts = []) {
  const ranked = rankFileContexts(query, fileContexts).slice(0, 4);
  const sourceCitations = [];
  const limitations = [];
  const tags = new Set();
  const mergedEvidence = [];
  let confidenceTotal = 0;

  for (const [sourceIndex, item] of ranked.entries()) {
    const ctx = item.context;
    const sourceKind = ctx.contentType === 'image'
      ? 'image'
      : ['spreadsheet', 'json'].includes(ctx.contentType)
        ? 'data'
        : ctx.contentType === 'audio'
          ? 'audio'
          : 'file';
    confidenceTotal += clamp01(ctx.confidence ?? item.relevance);
    for (const [citationIndex, citation] of normalizeList(ctx.sourceCitations).entries()) {
      sourceCitations.push({
        ...citation,
        id: `${sourceKind}:${sourceIndex + 1}.${citationIndex + 1}`,
        originalId: citation.id,
        label: citation.label || `${ctx.fileName || 'attachment'}#${citationIndex + 1}`
      });
    }
    for (const tag of normalizeList(ctx.semanticTags)) tags.add(tag);
    for (const warning of normalizeList(ctx.warnings)) limitations.push(warning);
    if (ctx.limitations) limitations.push(ctx.limitations);

    const evidence = ctx.compressedContext?.length
      ? ctx.compressedContext
        .map((chunk, chunkIndex) => `[${sourceKind}:${sourceIndex + 1}.${chunkIndex + 1}] ${chunk.text.slice(0, 800)}`)
        .join('\n')
      : `[${sourceKind}:${sourceIndex + 1}.1] ${String(ctx.primaryContent || '').slice(0, 1200)}`;
    mergedEvidence.push(`SOURCE ${ctx.fileName || 'file'} (${ctx.contentType || 'unknown'}, relevance ${item.relevance.toFixed(2)}):\n${evidence}`);
  }

  const confidence = ranked.length
    ? clamp01(confidenceTotal / ranked.length)
    : 0.35;

  const context = {
    hasFiles: ranked.length > 0,
    sourceCount: ranked.length,
    confidence,
    evidenceScore: clamp01((confidence + Math.min(sourceCitations.length, 5) / 5) / 2),
    sourceCitations: sourceCitations.slice(0, 10),
    sourceAttribution: sourceCitations.slice(0, 10).map((c) => c.label || c.id),
    semanticTags: Array.from(tags).slice(0, 12),
    limitations: [...new Set(limitations)].slice(0, 6),
    mergedEvidence: mergedEvidence.join('\n\n').slice(0, 7000),
    textSummary: textContext.summary || '',
    groundingInstruction: 'Gunakan hanya evidence dan sourceCitations untuk klaim tentang file. Bedakan fakta file, inferensi, dan batasan.'
  };

  observability.logEvent(traceId, 'CrossModalEngine', 'CONTEXT_BUILT', {
    sourceCount: context.sourceCount,
    confidence: context.confidence,
    citationCount: context.sourceCitations.length
  });

  return context;
}

function detectCitationMismatch(answer, crossModalContext) {
  if (!crossModalContext?.hasFiles) return false;
  const text = String(answer || '');
  const hasFileClaim = /file|dokumen|gambar|pdf|data|tabel|attachment|lampiran/i.test(text);
  if (!hasFileClaim) return false;
  const hasCitation = /\[(file|image|data|audio):\d+(?:\.\d+)?\]/i.test(text) || (crossModalContext.sourceAttribution || []).some((label) => text.includes(label));
  return !hasCitation;
}

function applyGroundingGuard(traceId, answer, crossModalContext) {
  let finalAnswer = String(answer || '');
  let annotation = null;
  let confidence = crossModalContext?.confidence ?? 0.5;

  if (!crossModalContext?.hasFiles) {
    return { answer: finalAnswer, annotation, confidence };
  }

  if (confidence < 0.45) {
    annotation = 'LOW_CONFIDENCE_FILE_ANALYSIS';
    finalAnswer += '\n\nCatatan: confidence analisis file rendah. Bagian tertentu mungkin tidak terbaca jelas, jadi hasil ini perlu diverifikasi ulang.';
  }

  if (detectCitationMismatch(finalAnswer, crossModalContext)) {
    annotation = annotation || 'CITATION_ADDED';
    const refs = (crossModalContext.sourceAttribution || []).slice(0, 3).join(', ');
    finalAnswer += `\n\nSumber file: ${refs || 'attachment yang dikirim user'}.`;
    confidence = Math.max(0.3, confidence - 0.08);
  }

  if (crossModalContext.limitations?.length) {
    finalAnswer += `\n\nBatasan analisis: ${crossModalContext.limitations.slice(0, 2).join(' ')}`;
  }

  observability.logEvent(traceId, 'CrossModalEngine', 'GROUNDING_GUARD_APPLIED', {
    annotation,
    confidence
  });

  return { answer: finalAnswer, annotation, confidence };
}

module.exports = {
  buildCrossModalContext,
  rankFileContexts,
  detectCitationMismatch,
  applyGroundingGuard
};
