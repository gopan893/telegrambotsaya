'use strict';

const observability = require('./observability');
const introspection = require('./introspection'); // Gunakan fitur dari Phase 5 sebagai bagian dari Reflection

/**
 * Reflection Agent (Phase 6)
 * Bertindak sebagai Hakim Tertinggi (Final Judge) dalam ekosistem Multi-Agent.
 * Mengelola Consensus Building, Resolusi Konflik antar agen, dan Self-Review akhir.
 */
class ReflectionAgent {
  constructor() {}

  calculateConsensusConfidence(opinions, meta, conflictDetected) {
    if (!opinions.length) return 0.5;
    const confidenceTotal = opinions.reduce((sum, [agentName]) => {
      const score = Number(meta[agentName]?.confidence ?? meta[agentName]?.score ?? 0.55);
      return sum + Math.max(0.1, Math.min(1, score));
    }, 0);
    const base = confidenceTotal / opinions.length;
    return Math.max(0.1, Math.min(1, base - (conflictDetected ? 0.18 : 0)));
  }

  pickPrimaryOpinion(opinions) {
    const byName = Object.fromEntries(opinions);
    return byName.ReasoningAgent
      || byName.ExecutorAgent
      || byName.ResearchAgent
      || opinions[opinions.length - 1]?.[1]
      || 'Tidak ada draf dari agen manapun.';
  }

  /**
   * Mengevaluasi konflik dari berbagai opini di Message Bus dan membangun konsensus
   */
  buildConsensus(traceId, messageBusCtx) {
    observability.logEvent(traceId, 'ReflectionAgent', 'CONSENSUS_BUILDING_START');
    
    if (!messageBusCtx || !messageBusCtx.agentOpinions) {
      return { reached: true, finalDecision: 'Tidak ada opini untuk dikonsensuskan.' };
    }

    const opinions = Object.entries(messageBusCtx.agentOpinions);
    const meta = messageBusCtx.agentOpinionMeta || {};
    
    // Jika hanya ada 1 opini, maka otomatis konsensus
    if (opinions.length <= 1) {
      return { 
        reached: true, 
        finalDecision: opinions.length === 1 ? opinions[0][1] : 'Tidak ada draf dari agen manapun.',
        metrics: {
          consensusConfidence: opinions.length === 1 ? Math.max(0.1, Math.min(1, Number(meta[opinions[0]?.[0]]?.confidence ?? 0.65))) : 0.5,
          agentCount: opinions.length,
          conflictDetected: false
        }
      };
    }

    // Deteksi konflik antar opini
    let conflictDetected = false;
    let combinedPerspectives = '';
    
    for (const [agentName, opinion] of opinions) {
      if (opinion.includes('Cacat logika') || opinion.includes('kelemahan asumsi') || opinion.includes('bukti terlalu lemah')) {
        conflictDetected = true;
      }
      if (meta[agentName]?.confidence !== undefined && meta[agentName].confidence < 0.4) {
        conflictDetected = true;
      }
      combinedPerspectives += `[${agentName} | confidence ${Number(meta[agentName]?.confidence ?? 0.55).toFixed(2)}]: ${String(opinion).slice(0, 900)}\n`;
    }

    if (conflictDetected) {
      observability.logEvent(traceId, 'ReflectionAgent', 'AGENT_CONFLICT_DETECTED', { iterations: messageBusCtx.iterations });
      
      if (messageBusCtx.iterations > (messageBusCtx.maxIterations || 8)) {
        // Prevent Infinite Loop / Agent Deadlock (Agent Conflict Protection)
        observability.logEvent(traceId, 'ReflectionAgent', 'FORCED_HALT_MAX_ITERATIONS');
        return {
          reached: false,
          finalDecision: 'Terjadi perbedaan pendapat internal yang tajam (Deadlock antar agen). Berdasarkan kebijakan aman, penyelesaian belum optimal. Silakan persempit pertanyaan Anda.',
          metrics: {
            consensusConfidence: 0.2,
            agentCount: opinions.length,
            conflictDetected: true
          }
        };
      }

      // Sintesis kompromi
      return {
        reached: true,
        finalDecision: `Setelah evaluasi multi-perspektif, sistem menyimpulkan adanya ambiguitas:\n${combinedPerspectives}`,
        metrics: {
          consensusConfidence: this.calculateConsensusConfidence(opinions, meta, true),
          agentCount: opinions.length,
          conflictDetected: true
        }
      };
    }

    observability.logEvent(traceId, 'ReflectionAgent', 'CONSENSUS_REACHED_SMOOTHLY');
    // Jika tidak ada konflik berarti semua setuju dengan opini utama (biasanya dari Executor/Reasoning).
    return {
      reached: true,
      finalDecision: this.pickPrimaryOpinion(opinions),
      metrics: {
        consensusConfidence: this.calculateConsensusConfidence(opinions, meta, false),
        agentCount: opinions.length,
        conflictDetected: false
      }
    };
  }

  /**
   * Melakukan refleksi akhir sebelum diserahkan ke Evaluator
   */
  reflectOnConsensus(traceId, consensusDecision, intent) {
    // Gunakan introspection logic untuk mengecek uncertainty final
    const introResult = introspection.introspect(traceId, consensusDecision, 0.8, intent);
    if (!introResult.passed) {
      return introResult.fallbackText || consensusDecision;
    }
    return consensusDecision;
  }
}

module.exports = new ReflectionAgent();
