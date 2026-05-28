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
      agentOpinionMeta: {},
      agentMessages: [],
      timeline: [],
      memoryAccess: [],
      conflicts: [],
      workflow: null,
      consensusReached: false,
      finalDecision: null,
      createdAt: Date.now(),
      iterations: 0,
      maxIterations: 8
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
    const ctx = this.sharedContexts.get(traceId);
    if (ctx) {
      ctx.timeline.push({
        ts: Date.now(),
        sender: senderName,
        topic,
        payloadPreview: String(JSON.stringify(payload || {})).slice(0, 280)
      });
      if (ctx.timeline.length > 80) ctx.timeline.shift();
    }
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
      if (key === 'workflow' && value?.maxIterations) {
        ctx.maxIterations = value.maxIterations;
      }
      // Emit event agar agen yang listen pada context update bisa bereaksi
      this.publish(traceId, 'MessageBus', 'CONTEXT_UPDATED', { key });
    }
  }

  recordAgentMessage(traceId, senderName, receiverName, topic, payload = {}) {
    const ctx = this.sharedContexts.get(traceId);
    if (!ctx) return;

    ctx.agentMessages.push({
      ts: Date.now(),
      sender: senderName,
      receiver: receiverName || 'ALL',
      topic,
      payloadPreview: String(JSON.stringify(payload || {})).slice(0, 280)
    });
    if (ctx.agentMessages.length > 60) ctx.agentMessages.shift();
    this.publish(traceId, senderName, 'AGENT_MESSAGE', { receiverName, topic });
  }

  recordMemoryAccess(traceId, agentName, memoryType, action, score = 0.5) {
    const ctx = this.sharedContexts.get(traceId);
    if (!ctx) return;

    ctx.memoryAccess.push({
      ts: Date.now(),
      agentName,
      memoryType,
      action,
      score
    });
    if (ctx.memoryAccess.length > 40) ctx.memoryAccess.shift();
    observability.logEvent(traceId, 'MessageBus', 'MEMORY_ACCESS_RECORDED', {
      agentName,
      memoryType,
      action,
      score
    });
  }

  recordConflict(traceId, sourceAgent, reason, severity = 'medium') {
    const ctx = this.sharedContexts.get(traceId);
    if (!ctx) return;

    ctx.conflicts.push({
      ts: Date.now(),
      sourceAgent,
      reason,
      severity
    });
    if (ctx.conflicts.length > 12) ctx.conflicts.shift();
    observability.logEvent(traceId, 'MessageBus', 'AGENT_CONFLICT_RECORDED', {
      sourceAgent,
      reason,
      severity
    });
  }

  /**
   * Mendaftarkan pendapat agen ke dalam pool konsensus
   */
  registerOpinion(traceId, agentName, opinionText, metadata = {}) {
    const ctx = this.sharedContexts.get(traceId);
    if (ctx) {
      ctx.agentOpinions[agentName] = opinionText;
      ctx.agentOpinionMeta[agentName] = {
        confidence: metadata.confidence ?? 0.55,
        role: metadata.role || null,
        score: metadata.score ?? metadata.confidence ?? 0.55,
        durationMs: metadata.durationMs || 0,
        tags: metadata.tags || []
      };
      ctx.iterations++;
      ctx.timeline.push({
        ts: Date.now(),
        sender: agentName,
        topic: 'OPINION_REGISTERED',
        payloadPreview: String(opinionText || '').slice(0, 280)
      });
      if (ctx.timeline.length > 80) ctx.timeline.shift();
      observability.logEvent(traceId, 'MessageBus', 'OPINION_REGISTERED', {
        agentName,
        iterations: ctx.iterations,
        confidence: ctx.agentOpinionMeta[agentName].confidence
      });
    }
  }

  /**
   * Bersihkan context setelah selesai agar RAM tidak bocor (Render free tier)
   */
  cleanupContext(traceId) {
    this.sharedContexts.delete(traceId);
    for (const eventName of this.eventNames()) {
      if (String(eventName).startsWith(`${traceId}:`)) {
        this.removeAllListeners(eventName);
      }
    }
    observability.logEvent(traceId, 'MessageBus', 'CONTEXT_CLEANUP');
  }
}

module.exports = new MessageBus();
