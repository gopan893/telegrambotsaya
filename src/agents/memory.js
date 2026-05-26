'use strict';

const observability = require('./observability');

/**
 * Advanced Memory Curator & Context Manager Agent (Phase 5)
 * Menyediakan arsitektur multi-tier: Short-term, Working, Semantic, Episodic, dan Tool Performance memory.
 */
class MemoryAgent {
  constructor() {
    this.maxSemanticFacts = 20; // Ditingkatkan, tapi tetap dibatasi untuk Render free tier
    this.maxEpisodicEvents = 10;
  }

  /**
   * Menghitung nilai kepentingan (*importance score*) dari suatu teks fakta.
   */
  assessImportanceScore(factText) {
    if (!factText) return 1;
    const lower = factText.toLowerCase();

    if (lower.includes('nama saya') || lower.includes('alamat') || lower.includes('admin')) return 10;
    if (lower.includes('suka') || lower.includes('preferensi') || lower.includes('koreksi')) return 8;
    if (lower.includes('tugas') || lower.includes('jadwal') || lower.includes('error')) return 5;
    return 2;
  }

  /**
   * Evaluasi fakta short-term untuk dipromosikan ke Semantic Memory (Memory Evolution)
   */
  evolveMemory(traceId, userId, botServices, newFacts = []) {
    const { ensureUser, persist } = botServices;
    const u = ensureUser(userId);
    
    if (!u.semanticMemory) u.semanticMemory = [];

    let promoted = 0;
    for (const fact of newFacts) {
      const score = this.assessImportanceScore(fact);
      // Promosikan hanya fakta bernilai tinggi ke semantic memory
      if (score >= 5 && !u.semanticMemory.includes(fact)) {
        u.semanticMemory.push(fact);
        promoted++;
      }
    }

    if (u.semanticMemory.length > this.maxSemanticFacts) {
      // Prune semantic memory berdasarkan importance
      u.semanticMemory = this.pruneMemory(traceId, u.semanticMemory.join('\n'), this.maxSemanticFacts).split('\n').map(l => l.replace(/^- /, ''));
    }

    if (promoted > 0) {
      persist();
      observability.logEvent(traceId, 'MemoryAgent', 'MEMORY_EVOLVED', { promotedCount: promoted });
    }
  }

  /**
   * Menyimpan kejadian spesifik (kegagalan, keberhasilan penting) ke Episodic Memory
   */
  recordEpisodicEvent(traceId, userId, eventType, description, botServices) {
    const { ensureUser, persist } = botServices;
    const u = ensureUser(userId);
    if (!u.episodicMemory) u.episodicMemory = [];

    u.episodicMemory.push({
      type: eventType,
      desc: description,
      timestamp: Date.now()
    });

    if (u.episodicMemory.length > this.maxEpisodicEvents) {
      u.episodicMemory.shift(); // Hapus memori terlama
    }
    persist();
  }

  /**
   * Mencatat statistik penggunaan Tool ke dalam memori Tool Performance
   */
  recordToolPerformance(userId, toolName, success, botServices) {
    const { ensureUser } = botServices;
    const u = ensureUser(userId);
    if (!u.toolPerformance) u.toolPerformance = {};
    if (!u.toolPerformance[toolName]) u.toolPerformance[toolName] = { success: 0, fail: 0 };
    
    if (success) {
      u.toolPerformance[toolName].success++;
    } else {
      u.toolPerformance[toolName].fail++;
    }
  }

  /**
   * Mengurutkan dan menyaring fakta memori (Relevance Ranking)
   */
  rankRelevance(traceId, userMessage, rawSummary, semanticMemory = []) {
    const facts = (rawSummary || '').split('\n').concat(semanticMemory).map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean);
    if (facts.length === 0) return 'Belum ada ringkasan fakta.';

    const lowerQuery = String(userMessage || '').toLowerCase();
    
    const scoredFacts = facts.map(fact => {
      const lowerFact = fact.toLowerCase();
      let matchCount = 0;
      const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        if (lowerFact.includes(w)) matchCount += 2;
      }
      const importance = this.assessImportanceScore(fact);
      return { text: fact, score: matchCount + (importance * 0.5) };
    });

    scoredFacts.sort((a, b) => b.score - a.score);
    // Ambil maksimal 8 fakta gabungan teratas
    const uniqueFacts = [...new Set(scoredFacts.slice(0, 8).map(f => `- ${f.text}`))];
    return uniqueFacts.join('\n');
  }

  /**
   * Context Window Compression
   */
  compressContext(traceId, historyList) {
    if (!historyList || historyList.length === 0) return 'Tidak ada riwayat percakapan.';
    const recent = historyList.slice(-6);
    return recent.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.text}`).join('\n');
  }

  /**
   * Memory Aging & Pruning Policy
   */
  pruneMemory(traceId, rawSummary, maxLimit = 15) {
    if (!rawSummary) return '';
    const facts = rawSummary.split('\n').map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean);
    if (facts.length <= maxLimit) return rawSummary;

    const scoredFacts = facts.map(fact => ({ text: fact, importance: this.assessImportanceScore(fact) }));
    scoredFacts.sort((a, b) => b.importance - a.importance);
    return scoredFacts.slice(0, maxLimit).map(f => `- ${f.text}`).join('\n');
  }

  // --- Phase 7: Attachment Memory Store ---

  /**
   * Menyimpan hasil parsing file ke cache agar tidak perlu parsing ulang
   */
  cacheFileResult(userId, fileId, fileContext, botServices) {
    const { ensureUser } = botServices;
    const u = ensureUser(userId);
    if (!u.fileMemory) u.fileMemory = {};

    u.fileMemory[fileId] = {
      ...fileContext,
      cachedAt: Date.now()
    };

    // Batasi cache file max 10 entri per user
    const keys = Object.keys(u.fileMemory);
    if (keys.length > 10) {
      delete u.fileMemory[keys[0]]; // Hapus entri tertua
    }
  }

  indexFileContext(traceId, userId, fileId, fileContext, botServices) {
    const { ensureUser, persist } = botServices;
    const u = ensureUser(userId);
    if (!u.fileIndex) u.fileIndex = [];

    const existingIndex = u.fileIndex.findIndex(item => item.fileId === fileId);
    const indexEntry = {
      fileId,
      fileName: fileContext.fileName,
      contentType: fileContext.contentType,
      semanticTags: fileContext.semanticTags || [],
      keyPoints: (fileContext.keyPoints || []).slice(0, 5),
      sourceAttribution: (fileContext.sourceAttribution || []).slice(0, 5),
      confidence: fileContext.confidence || 0.5,
      hash: fileContext.hash || null,
      indexedAt: Date.now()
    };

    if (existingIndex >= 0) {
      u.fileIndex[existingIndex] = indexEntry;
    } else {
      u.fileIndex.push(indexEntry);
    }

    if (u.fileIndex.length > 12) u.fileIndex.shift();

    if (typeof persist === 'function') {
      const maybePromise = persist();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(err => observability.recordErrorPattern('file_index_persist', err));
      }
    }

    observability.logEvent(traceId, 'MemoryAgent', 'FILE_CONTEXT_INDEXED', {
      fileName: fileContext.fileName,
      contentType: fileContext.contentType,
      confidence: fileContext.confidence
    });
  }

  /**
   * Mengecek apakah file sudah pernah diparsing (deduplication)
   */
  getCachedFile(userId, fileId, botServices) {
    const { ensureUser } = botServices;
    const u = ensureUser(userId);
    return (u.fileMemory && u.fileMemory[fileId]) || null;
  }

  getRecentFileContexts(userId, botServices, limit = 3) {
    const { ensureUser } = botServices;
    const u = ensureUser(userId);
    const fileMemory = u.fileMemory || {};
    return Object.values(fileMemory)
      .sort((a, b) => (b.cachedAt || b.extractedAt || 0) - (a.cachedAt || a.extractedAt || 0))
      .slice(0, limit);
  }

  /**
   * Menyimpan insight penting dari file ke semantic memory (File-based Learning)
   */
  learnFromFile(traceId, userId, keyPoints, fileName, botServices) {
    const { ensureUser, persist } = botServices;
    const u = ensureUser(userId);
    if (!u.semanticMemory) u.semanticMemory = [];

    let learned = 0;
    for (const point of (keyPoints || []).slice(0, 3)) {
      const tagged = `[File: ${fileName}] ${point}`;
      if (!u.semanticMemory.includes(tagged)) {
        u.semanticMemory.push(tagged);
        learned++;
      }
    }

    // Prune jika membengkak
    if (u.semanticMemory.length > this.maxSemanticFacts) {
      u.semanticMemory = u.semanticMemory.slice(-this.maxSemanticFacts);
    }

    if (learned > 0) {
      persist();
      observability.logEvent(traceId, 'MemoryAgent', 'FILE_KNOWLEDGE_LEARNED', { learned, fileName });
    }
  }
}

module.exports = new MemoryAgent();
