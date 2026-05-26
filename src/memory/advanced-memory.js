/**
 * Advanced Memory System
 * Mengelola memori sesi percakapan multi-step, selective memory loading,
 * smart caching, dan perlindungan injeksi memori (invalid memory injection protection).
 * 
 * Teknologi: CommonJS (Node.js 20), Ram-optimized.
 */

const { BoundedTTLMap } = require('../../core/ttl-map');

// Cache lokal berumur pendek untuk memory query guna menghindari overhead IO berulang
const memoryQueryCache = new BoundedTTLMap({ ttlMs: 1 * 60 * 1000, max: 200 });
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function getEmptySessionState() {
  return {
    activeTask: null,
    steps: [],
    currentStepIndex: -1,
    contextData: {},
    lastActiveAt: 0
  };
}

/**
 * Mendeteksi upaya Prompt Injection di dalam teks memori sebelum menyimpannya.
 * Menghindari "Invalid Memory Injection".
 * @param {string} text 
 * @returns {boolean} true jika terdeteksi berbahaya
 */
function detectMemoryInjection(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  
  // Kata kunci mencurigakan yang mencoba mengubah role sistem di memori
  const patterns = [
    'ignore previous',
    'abaikan instruksi',
    'kamu sekarang adalah',
    'you are now',
    'system prompt',
    'override instruction',
    'reset system',
    'hack memory'
  ];
  
  return patterns.some(p => lower.includes(p));
}

/**
 * Menyaring teks memori agar bersih dari karakter ilegal atau pemformatan berlebih.
 * @param {string} text 
 * @returns {string} teks bersih
 */
function sanitizeMemoryText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '') // Hapus karakter kontrol biner berbahaya
    .trim()
    .slice(0, 1000); // Batasi ukuran maksimal fakta memori
}

/**
 * Menginisialisasi status sesi multi-step untuk pengguna jika belum ada.
 * @param {object} userObj objek user dari memory store
 */
function ensureSessionState(userObj) {
  if (!userObj.sessionState) {
    userObj.sessionState = getEmptySessionState();
  }

  const session = userObj.sessionState;
  if (
    session.activeTask &&
    session.lastActiveAt &&
    Date.now() - session.lastActiveAt > SESSION_TTL_MS
  ) {
    userObj.sessionState = getEmptySessionState();
  }
  return userObj.sessionState;
}

/**
 * Memuat konteks memori secara selektif (Selective Memory Loading) untuk menghemat RAM.
 * Alih-alih memuat seluruh riwayat percakapan mentah ke LLM, kita memilah:
 * 1. 5 riwayat percakapan jangka pendek terakhir (shortMemory)
 * 2. Ringkasan profil (profile summary) user
 * 3. Tag user untuk mengambil topik minat yang relevan
 * 4. Status sesi multi-step (jika ada)
 * 
 * @param {string} userId 
 * @param {object} botServices Objek layanan bot (termasuk userMemory, shortMemory)
 * @returns {object} Konteks terkompresi yang siap di-inject ke prompt LLM
 */
function getSelectiveContext(userId, botServices) {
  const cacheKey = `ctx:${userId}`;
  const cached = memoryQueryCache.get(cacheKey);
  if (cached) return cached;

  const { ensureUser, shortMemory = [] } = botServices;
  const u = ensureUser(userId);
  const session = ensureSessionState(u);

  // 1. Ambil shortMemory terakhir yang relevan (hanya punya user ini)
  const userShortMemory = shortMemory
    .filter(m => String(m.userId) === String(userId))
    .slice(-6)
    .map(m => `User: ${m.q}\nBot: ${m.a}`)
    .join('\n\n');

  // 2. Format Todo List aktif
  const openTodos = (u.todos || [])
    .filter(t => !t.done)
    .slice(-5)
    .map(t => `- ${t.text}`)
    .join('\n');

  // 3. Format Reminder aktif
  const activeReminders = (u.reminders || [])
    .slice(-5)
    .map(r => `- ${r.message} (${r.time})`)
    .join('\n');

  // 4. Integrasikan Multi-Step Session State jika aktif
  let sessionStateStr = 'Tidak ada tugas aktif berjalan.';
  if (session.activeTask) {
    const completedSteps = session.steps.filter((_, idx) => idx < session.currentStepIndex).length;
    sessionStateStr = `
- Tugas Aktif: "${session.activeTask}"
- Progress: Langkah ${session.currentStepIndex + 1} dari ${session.steps.length} (${completedSteps} selesai)
- Langkah Sekarang: "${session.steps[session.currentStepIndex] || 'Selesai'}"
- Data Konteks Terkumpul: ${JSON.stringify(session.contextData)}
    `.trim();
  }

  const contextData = {
    botName: u.botName || 'Bot AI',
    mode: u.mode || 'santai',
    mood: u.mood || 'biasa',
    summary: u.summary || 'Belum ada ringkasan fakta.',
    tags: (u.tags || []).join(', ') || 'tidak ada',
    todos: openTodos || 'tidak ada',
    reminders: activeReminders || 'tidak ada',
    history: userShortMemory || 'tidak ada riwayat percakapan.',
    sessionState: sessionStateStr,
    rawSession: session
  };

  memoryQueryCache.set(cacheKey, contextData);
  return contextData;
}

/**
 * Menyimpan fakta penting baru ke profil user secara aman.
 * @param {string} userId 
 * @param {string} text Fakta baru
 * @param {object} botServices 
 * @returns {Promise<boolean>} true jika tersimpan
 */
async function recordMemoryFact(userId, text, botServices) {
  if (!text || detectMemoryInjection(text)) {
    return false;
  }

  const { ensureUser, persist } = botServices;
  const u = ensureUser(userId);
  const cleanFact = sanitizeMemoryText(text);

  if (!cleanFact) return false;

  // Hindari duplikasi fakta jika sudah ada di summary
  if (u.summary && u.summary.includes(cleanFact)) {
    return false;
  }

  u.summary = u.summary ? `${u.summary}\n- ${cleanFact}` : `- ${cleanFact}`;
  u.summary = u.summary.trim().slice(-1500); // Batasi ukuran maksimal summary agar hemat RAM

  // Bersihkan cache lokal karena memori telah berubah
  memoryQueryCache.delete(`ctx:${userId}`);

  await persist();
  return true;
}

/**
 * Memperbarui status sesi multi-step secara aman.
 * @param {string} userId 
 * @param {object} nextState State baru untuk di-merge
 * @param {object} botServices 
 */
async function updateSessionState(userId, nextState, botServices) {
  const { ensureUser, persist } = botServices;
  const u = ensureUser(userId);
  const session = ensureSessionState(u);

  // Injeksi validasi data kompleks sebelum merger
  if (nextState.contextData) {
    for (const [key, value] of Object.entries(nextState.contextData)) {
      if (detectMemoryInjection(String(key)) || detectMemoryInjection(String(value))) {
        throw new Error('Terdeteksi upaya Injeksi Memori Ilegal dalam parameter sesi!');
      }
    }
  }

  // Update field yang sah
  if (nextState.activeTask !== undefined) session.activeTask = nextState.activeTask;
  if (nextState.steps !== undefined) session.steps = nextState.steps;
  if (nextState.currentStepIndex !== undefined) session.currentStepIndex = nextState.currentStepIndex;
  if (nextState.contextData !== undefined) {
    session.contextData = { ...session.contextData, ...nextState.contextData };
  }
  
  session.lastActiveAt = Date.now();

  // Bersihkan cache lokal
  memoryQueryCache.delete(`ctx:${userId}`);
  
  await persist();
}

/**
 * Menghapus/mereset status sesi multi-step.
 * @param {string} userId 
 * @param {object} botServices 
 */
async function clearSessionState(userId, botServices) {
  const { ensureUser, persist } = botServices;
  const u = ensureUser(userId);
  
  u.sessionState = getEmptySessionState();

  // Bersihkan cache lokal
  memoryQueryCache.delete(`ctx:${userId}`);
  
  await persist();
}

module.exports = {
  detectMemoryInjection,
  sanitizeMemoryText,
  ensureSessionState,
  getSelectiveContext,
  recordMemoryFact,
  updateSessionState,
  clearSessionState
};
