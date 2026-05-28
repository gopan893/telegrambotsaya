/**
 * Self-Analysis, Reflection & Learning Engine
 * Melakukan post-processing respons bot sebelum dikirim untuk menyaring halusinasi,
 * respons ganda (duplicate), infinite loop, serta mengintegrasikan pembelajaran interaktif.
 * 
 * Teknologi: CommonJS (Node.js 20), Output Filtering, String Similarity checking.
 */


/**
 * Menghitung koefisien kesamaan Dice's Coefficient sederhana antara dua string.
 * Berguna untuk mendeteksi respons duplikat.
 * 
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Nilai kesamaan antara 0.0 - 1.0
 */
function calculateStringSimilarity(str1, str2) {
  const s1 = String(str1 || '').toLowerCase().replace(/\s+/g, '');
  const s2 = String(str2 || '').toLowerCase().replace(/\s+/g, '');
  
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substr(i, 2);
    const count = bigrams1.has(bigram) ? bigrams1.get(bigram) + 1 : 1;
    bigrams1.set(bigram, count);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substr(i, 2);
    const count = bigrams1.get(bigram);
    if (count && count > 0) {
      intersection++;
      bigrams1.set(bigram, count - 1);
    }
  }

  return (2.0 * intersection) / (s1.length + s2.length - 2);
}

/**
 * Memastikan respons bot tidak mengandung klaim palsu (Hallucination Detection).
 * Misalnya, bot mengklaim telah menyimpan event ke Google Calendar padahal aslinya gagal/tidak dipanggil.
 * 
 * @param {string} responseText Jawaban draf yang diusulkan oleh LLM
 * @param {object} executionResult Laporan eksekusi tool di tingkat asisten
 * @returns {string} Jawaban bersih yang telah direfleksikan dan disesuaikan jika terdeteksi halusinasi
 */
function reflectAndCorrectHallucination(responseText, executionResult) {
  if (!responseText) return '';

  const lowerResponse = responseText.toLowerCase();
  const { toolExecuted, ok, error } = executionResult || {};

  // Kasus 1: LLM mengklaim berhasil menambahkan event Kalender tetapi aslinya tool calendar TIDAK dipanggil atau GAGAL
  const claimsCalendarSuccess = lowerResponse.includes('google calendar') && 
                                (lowerResponse.includes('berhasil') || lowerResponse.includes('sudah saya') || lowerResponse.includes('telah dijadwalkan') || lowerResponse.includes('tambahkan'));
  
  if (claimsCalendarSuccess) {
    if (!toolExecuted || toolExecuted !== 'TAMBAH_EVENT' || !ok) {
      // Terjadi halusinasi! Koreksi respons tersebut secara cerdas
      console.warn('⚠️ Deteksi Halusinasi: Bot mengklaim berhasil menjadwalkan Kalender, tetapi status eksekusi gagal.');
      
      const errMsg = error ? `(Error: ${error})` : '';
      return `Maaf, saya tidak bisa menjadwalkan acara tersebut ke Google Calendar saat ini karena masalah autentikasi atau konfigurasi ${errMsg}. Namun, saya mencatatnya sebagai Todo internal: "${executionResult.params?.summary || 'Tugas Baru'}".`;
    }
  }

  // Kasus 2: LLM mengklaim cuaca berhasil dicek padahal server cuaca error
  const claimsWeatherSuccess = lowerResponse.includes('cuaca di') && !lowerResponse.includes('gagal') && !lowerResponse.includes('error');
  if (claimsWeatherSuccess && toolExecuted === 'CUACA' && !ok) {
    console.warn('⚠️ Deteksi Halusinasi: Bot mengklaim berhasil cek cuaca, tetapi status eksekusi tool cuaca gagal.');
    return `Maaf, saya mengalami kesulitan menghubungi server cuaca saat ini. Coba sebutkan nama kota lain atau ulangi beberapa saat lagi.`;
  }

  return responseText;
}

/**
 * Mendeteksi jika bot mengirimkan respons yang berulang-ulang dari riwayat terdekat (Duplicate Response Detection).
 * Mencegah bot tampak bodoh dengan membalas kalimat yang sama persis.
 * 
 * @param {string} responseText 
 * @param {string} userId 
 * @param {object} botServices 
 * @returns {boolean} true jika respons terdeteksi duplikat
 */
function isDuplicateResponse(responseText, userId, botServices) {
  const { shortMemory = [] } = botServices;

  // Filter 4 pesan asisten terakhir khusus untuk pengguna ini
  const recentAssistantMsgs = shortMemory
    .filter(m => String(m.userId) === String(userId))
    .slice(-4)
    .map(m => m.a);

  for (const prevMsg of recentAssistantMsgs) {
    const similarity = calculateStringSimilarity(responseText, prevMsg);
    if (similarity > 0.88) {
      console.warn(`⚠️ Deteksi Duplikasi: Kemiripan respons (${(similarity * 100).toFixed(1)}%) melebihi batas 88%.`);
      return true;
    }
  }

  return false;
}

/**
 * Mencegah bot masuk ke dalam siklus rekursi obrolan gila (Infinite Loop Prevention).
 * Mendeteksi jika user mengirim pesan yang sama persis berulang kali dan bot memberikan jawaban yang sama berulang kali.
 * 
 * @param {string} userId 
 * @param {object} botServices 
 * @returns {boolean} true jika terdeteksi indikasi infinite loop
 */
function detectInfiniteLoop(userId, botServices) {
  const { shortMemory = [] } = botServices;

  const recentUserHistory = shortMemory
    .filter(m => String(m.userId) === String(userId))
    .slice(-3);

  if (recentUserHistory.length < 3) return false;

  // Jika 3 pesan terakhir pengguna memiliki kemiripan yang sangat tinggi (>90%)
  const u1 = recentUserHistory[0].q;
  const u2 = recentUserHistory[1].q;
  const u3 = recentUserHistory[2].q;
  
  if (!u1 || !u2 || !u3) return false;

  const userLooping = calculateStringSimilarity(u1, u2) > 0.9 && calculateStringSimilarity(u2, u3) > 0.9;
  
  // Jika 3 jawaban asisten sebelumnya juga mirip (>90%)
  const a1 = recentUserHistory[0].a;
  const a2 = recentUserHistory[1].a;
  const a3 = recentUserHistory[2].a;

  if (!a1 || !a2 || !a3) return false;

  const assistantLooping = calculateStringSimilarity(a1, a2) > 0.9 && calculateStringSimilarity(a2, a3) > 0.9;

  if (userLooping && assistantLooping) {
    console.warn(`🚨 Deteksi Infinite Loop untuk user ${userId}. Melakukan pembatasan percakapan.`);
    return true;
  }

  return false;
}

/**
 * Learning Engine: Menyimpan koreksi dari user (self-correction)
 * Dipanggil ketika user mengajari bot menggunakan format /koreksi
 * 
 * @param {string} userId 
 * @param {string} question Pertanyaan asli yang salah dipahami
 * @param {string} correctIntent Intent yang seharusnya
 * @param {object} correctParams Parameter yang seharusnya
 * @param {object} botServices 
 */
async function recordUserCorrection(userId, question, correctIntent, correctParams, botServices) {
  const { ensureUser, persist } = botServices;
  const u = ensureUser(userId);

  if (!u.nlpPatterns) u.nlpPatterns = [];

  u.nlpPatterns.push({
    question: String(question || '').toLowerCase().trim(),
    intent: correctIntent,
    params: correctParams || {},
    timestamp: Date.now()
  });

  // Batasi agar maksimal 100 pola pembelajaran untuk menghemat RAM
  if (u.nlpPatterns.length > 100) {
    u.nlpPatterns.shift();
  }

  await persist();
  console.log(`🎓 Learning Engine: Berhasil mempelajari koreksi untuk kueri: "${question}" -> ${correctIntent}`);
}

module.exports = {
  calculateStringSimilarity,
  reflectAndCorrectHallucination,
  isDuplicateResponse,
  detectInfiniteLoop,
  recordUserCorrection
};
