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

  /**
   * Mengevaluasi konflik dari berbagai opini di Message Bus dan membangun konsensus
   */
  buildConsensus(traceId, messageBusCtx) {
    observability.logEvent(traceId, 'ReflectionAgent', 'CONSENSUS_BUILDING_START');
    
    if (!messageBusCtx || !messageBusCtx.agentOpinions) {
      return { reached: true, finalDecision: 'Tidak ada opini untuk dikonsensuskan.' };
    }

    const opinions = Object.entries(messageBusCtx.agentOpinions);
    
    // Jika hanya ada 1 opini, maka otomatis konsensus
    if (opinions.length <= 1) {
      return { 
        reached: true, 
        finalDecision: opinions.length === 1 ? opinions[0][1] : 'Tidak ada draf dari agen manapun.'
      };
    }

    // Deteksi konflik antar opini
    let conflictDetected = false;
    let combinedPerspectives = '';
    
    for (const [agentName, opinion] of opinions) {
      if (opinion.includes('Cacat logika') || opinion.includes('kelemahan asumsi') || opinion.includes('bukti terlalu lemah')) {
        conflictDetected = true;
      }
      combinedPerspectives += `[${agentName}]: ${opinion}\n`;
    }

    if (conflictDetected) {
      observability.logEvent(traceId, 'ReflectionAgent', 'AGENT_CONFLICT_DETECTED', { iterations: messageBusCtx.iterations });
      
      if (messageBusCtx.iterations > 3) {
        // Prevent Infinite Loop / Agent Deadlock (Agent Conflict Protection)
        observability.logEvent(traceId, 'ReflectionAgent', 'FORCED_HALT_MAX_ITERATIONS');
        return {
          reached: false,
          finalDecision: 'Terjadi perbedaan pendapat internal yang tajam (Deadlock antar agen). Berdasarkan kebijakan aman, penyelesaian belum optimal. Silakan persempit pertanyaan Anda.'
        };
      }

      // Sintesis kompromi
      return {
        reached: true,
        finalDecision: `Setelah evaluasi multi-perspektif, sistem menyimpulkan adanya ambiguitas:\n${combinedPerspectives}`
      };
    }

    observability.logEvent(traceId, 'ReflectionAgent', 'CONSENSUS_REACHED_SMOOTHLY');
    // Jika tidak ada konflik berarti semua setuju dengan opini utama (biasanya dari Executor/Reasoning)
    return {
      reached: true,
      finalDecision: opinions.length > 0 ? opinions[opinions.length - 1][1] : 'Selesai.'
    };
  }

  /**
   * Melakukan refleksi akhir sebelum diserahkan ke Evaluator
   */
  reflectOnConsensus(traceId, consensusDecision, intent) {
    // Gunakan introspection logic untuk mengecek uncertainty final
    const introResult = introspection.introspect(traceId, consensusDecision, 0.8, intent);
    if (!introResult.passed) {
      return introResult.fallbackText;
    }
    return consensusDecision;
  }
}

module.exports = new ReflectionAgent();
