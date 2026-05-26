'use strict';

const observability = require('./observability');

/**
 * Research Agent (Phase 6)
 * Bertugas mengumpulkan informasi pendukung, mencari fakta, 
 * memvalidasi sumber, dan memberikan skor bukti (Evidence Strength Score).
 */
class ResearchAgent {
  constructor() {}

  /**
   * Menganalisis tingkat kepercayaan dari bukti yang ada (Mockup / Heuristic)
   */
  evaluateEvidenceStrength(factsText) {
    if (!factsText) return 0.1;
    let score = 0.5;
    const lower = factsText.toLowerCase();

    // Validasi heuristik
    if (lower.includes('sumber resmi') || lower.includes('dokumentasi')) score += 0.3;
    if (lower.includes('forum') || lower.includes('katanya')) score -= 0.2;
    if (lower.includes('tidak yakin') || lower.includes('belum diverifikasi')) score -= 0.4;

    return Math.max(0.1, Math.min(1.0, score));
  }

  /**
   * Mengumpulkan fakta relevan terkait query
   */
  gatherEvidence(traceId, query, sharedContext) {
    observability.logEvent(traceId, 'ResearchAgent', 'GATHERING_EVIDENCE', { query });

    // Simulasi penarikan memori dari shared context atau pencarian eksternal
    const memorySummary = sharedContext.summary || '';
    const factPool = memorySummary.split('\n').filter(f => f.trim().length > 0);

    // Kumpulkan fakta yang relevan dengan query
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relevantFacts = factPool.filter(fact => 
      words.some(w => fact.toLowerCase().includes(w))
    );

    const evidenceText = relevantFacts.length > 0 
      ? relevantFacts.join('\n') 
      : 'Tidak ada bukti spesifik di memori lokal.';

    const strength = this.evaluateEvidenceStrength(evidenceText);

    observability.logEvent(traceId, 'ResearchAgent', 'EVIDENCE_GATHERED', { 
      factCount: relevantFacts.length, 
      strength 
    });

    return {
      agent: 'ResearchAgent',
      evidenceText,
      confidence: strength
    };
  }
}

module.exports = new ResearchAgent();
