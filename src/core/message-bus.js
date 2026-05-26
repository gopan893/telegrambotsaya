'use strict';

const EventEmitter = require('events');
const observability = require('../agents/observability');

/**
 * Internal Message Bus & Collaborative Shared Memory (Phase 6)
 * Sistem komunikasi saraf pusat antar agen. Mengelola debat, konsensus, 
 * dan pertukaran state sementara selama 1 siklus request berlangsung (in-memory).
 */
class MessageBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Mendukung hingga 20 agen yang listening
    // Shared Memory ephemeral untuk tiap traceId
    this.sharedContexts = new Map(); 
  }

  /**
   * Inisialisasi shared context untuk siklus request baru
   */
  initContext(traceId, initialData = {}) {
    this.sharedContexts.set(traceId, {
      ...initialData,
      agentOpinions: {}, // { agentName: opinionText }
      consensusReached: false,
      finalDecision: null,
      createdAt: Date.now(),
      iterations: 0
    });
    observability.logEvent(traceId, 'MessageBus', 'CONTEXT_INITIALIZED');
  }

  /**
   * Mengirim pesan dari satu agen ke bus
   * @param {string} traceId 
   * @param {string} senderName (e.g. 'ResearchAgent')
   * @param {string} topic (e.g. 'EVIDENCE_FOUND')
   * @param {any} payload 
   */
  publish(traceId, senderName, topic, payload) {
    observability.logEvent(traceId, 'MessageBus', `PUBLISH_${topic}`, { sender: senderName });
    this.emit(`${traceId}:${topic}`, { sender: senderName, payload });
  }

  /**
   * Membaca context/shared memory saat ini
   */
  getContext(traceId) {
    return this.sharedContexts.get(traceId) || null;
  }

  /**
   * Memperbarui state pada shared memory untuk dibaca agen lain
   */
  updateContext(traceId, key, value) {
    const ctx = this.sharedContexts.get(traceId);
    if (ctx) {
      ctx[key] = value;
      // Emit event agar agen yang listen pada context update bisa bereaksi
      this.publish(traceId, 'MessageBus', 'CONTEXT_UPDATED', { key });
    }
  }

  /**
   * Mendaftarkan pendapat agen ke dalam pool konsensus
   */
  registerOpinion(traceId, agentName, opinionText) {
    const ctx = this.sharedContexts.get(traceId);
    if (ctx) {
      ctx.agentOpinions[agentName] = opinionText;
      ctx.iterations++;
      observability.logEvent(traceId, 'MessageBus', 'OPINION_REGISTERED', { agentName, iterations: ctx.iterations });
    }
  }

  /**
   * Bersihkan context setelah selesai agar RAM tidak bocor (Render free tier)
   */
  cleanupContext(traceId) {
    this.sharedContexts.delete(traceId);
    this.removeAllListeners(traceId); // Hapus semua listener khusus trace ini
    observability.logEvent(traceId, 'MessageBus', 'CONTEXT_CLEANUP');
  }
}

module.exports = new MessageBus();
