'use strict';

/**
 * Lightweight, RAM-Optimized Production Task Queue System
 * Fitur: Concurrency Control, Rate Limiting, Deduplication, dan Idempotency Protection.
 * Dioptimalkan untuk Render free tier.
 */
class TaskQueue {
  constructor({
    maxConcurrency = 2,
    userRateLimitMs = 1000,
    idempotencyWindowMs = 5000,
    maxQueueSize = 30,
    taskTimeoutMs = 45000
  } = {}) {
    this.maxConcurrency = maxConcurrency;
    this.userRateLimitMs = userRateLimitMs;
    this.idempotencyWindowMs = idempotencyWindowMs;
    this.maxQueueSize = maxQueueSize;
    this.taskTimeoutMs = taskTimeoutMs;
    
    this.activeCount = 0;
    this.queue = [];
    this.userLastRequestTime = new Map();
    
    // Idempotency: Map dari key (userId:hash) -> { ts, result }
    this.processedRequests = new Map();
    
    // Deduplication: Map dari userId -> { text, ts }
    this.lastProcessedRequest = new Map();
  }

  /**
   * Menghasilkan hash sederhana untuk teks kueri guna keperluan idempotensi
   */
  generateRequestHash(userId, text) {
    const clean = String(text || '').trim().toLowerCase();
    return `${userId}:${clean}`;
  }

  /**
   * Melakukan registrasi tugas ke antrean dan mengevakuasinya secara asinkron sesuai batas konkurensi.
   * @param {string} userId
   * @param {string} text
   * @param {Function} taskFn Fungsi asinkron yang melambangkan pipa pemrosesan AI agen
   * @returns {Promise<any>} Hasil eksekusi tugas
   */
  async enqueue(userId, text, taskFn) {
    const now = Date.now();
    const cleanText = String(text || '').trim();

    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('QUEUE_OVERLOADED: Antrean penuh, sistem sedang melindungi stabilitas runtime.');
    }

    // 1. Idempotency Protection: Jika request identik dalam jendela idempotensi sedang/baru diproses, kembalikan hasil sebelumnya
    const idempotencyKey = this.generateRequestHash(userId, cleanText);
    const existingRecord = this.processedRequests.get(idempotencyKey);
    if (existingRecord && now - existingRecord.ts < this.idempotencyWindowMs) {
      console.log(`[Idempotency] Menggunakan hasil cache untuk kueri: "${cleanText}"`);
      return existingRecord.result;
    }

    // 2. Deduplication Check: Hindari memproses request identik berturut-turut dalam waktu dekat (misal tombol dipencet ganda)
    const lastReq = this.lastProcessedRequest.get(userId);
    if (lastReq && lastReq.text === cleanText && now - lastReq.ts < 2000) {
      throw new Error('DUPLICATE_REQUEST_BLOCKED: Pesan identik terdeteksi dikirim berturut-turut.');
    }

    // 3. Rate Control opsional: bot utama sudah punya antispam Telegram.
    // Queue ini fokus menjaga concurrency dan deduplication agar multi-step chat tetap lancar.
    const lastTime = this.userLastRequestTime.get(userId) || 0;
    if (this.userRateLimitMs > 0 && now - lastTime < this.userRateLimitMs) {
      throw new Error('RATE_LIMIT_EXCEEDED: Mohon berikan jeda antar pesan Anda.');
    }
    this.userLastRequestTime.set(userId, now);

    this.lastProcessedRequest.set(userId, { text: cleanText, ts: now });

    // 4. Masukkan ke Antrean Konkurensi
    return new Promise((resolve, reject) => {
      this.queue.push({
        userId,
        text: cleanText,
        idempotencyKey,
        taskFn,
        resolve,
        reject
      });
      
      this.processNext();
    });
  }

  async runWithTimeout(taskFn) {
    if (!this.taskTimeoutMs || this.taskTimeoutMs <= 0) {
      return taskFn();
    }

    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('TASK_TIMEOUT: Tugas melampaui batas waktu eksekusi.'));
      }, this.taskTimeoutMs);
    });

    try {
      return await Promise.race([taskFn(), timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Menjalankan antrean berikutnya jika kapasitas konkurensi mencukupi
   */
  async processNext() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.activeCount += 1;
    const task = this.queue.shift();

    try {
      console.log(`[TaskQueue] Menjalankan tugas. Aktif: ${this.activeCount}/${this.maxConcurrency}. Sisa antrean: ${this.queue.length}`);
      
      const result = await this.runWithTimeout(task.taskFn);
      
      // Simpan hasil untuk proteksi idempotensi
      this.processedRequests.set(task.idempotencyKey, {
        ts: Date.now(),
        result
      });

      task.resolve(result);
    } catch (err) {
      task.reject(err);
    } finally {
      this.activeCount -= 1;
      this.cleanupCache();
      this.processNext();
    }
  }

  /**
   * Membersihkan data cache yang kadaluarsa untuk mencegah kebocoran memori (RAM-optimized)
   */
  cleanupCache() {
    const now = Date.now();
    
    // Bersihkan data idempotensi kadaluarsa
    for (const [key, record] of this.processedRequests.entries()) {
      if (now - record.ts > this.idempotencyWindowMs * 2) {
        this.processedRequests.delete(key);
      }
    }

    // Bersihkan deduplication cache kadaluarsa
    for (const [userId, req] of this.lastProcessedRequest.entries()) {
      if (now - req.ts > 10000) {
        this.lastProcessedRequest.delete(userId);
      }
    }

    // Bersihkan rate limit cache kadaluarsa
    for (const [userId, ts] of this.userLastRequestTime.entries()) {
      if (now - ts > 60000) {
        this.userLastRequestTime.delete(userId);
      }
    }
  }

  /**
   * Mengembalikan status antrean saat ini
   */
  getTelemetry() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueSize: this.maxQueueSize,
      taskTimeoutMs: this.taskTimeoutMs,
      idempotencyCacheSize: this.processedRequests.size,
      dedupeCacheSize: this.lastProcessedRequest.size
    };
  }
}

// Singleton global untuk seluruh sistem aplikasi
const globalTaskQueue = new TaskQueue({
  maxConcurrency: 2,
  userRateLimitMs: 0,
  idempotencyWindowMs: 5000,
  maxQueueSize: 30,
  taskTimeoutMs: 45000
});

module.exports = {
  TaskQueue,
  globalTaskQueue
};
