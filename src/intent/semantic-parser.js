/**
 * Semantic Intent Parser & Parameter Extractor
 * Menganalisis pesan pengguna menggunakan LLM untuk menentukan intent secara semantik,
 * mengekstrak parameter, menghitung confidence score, dan mencegah prompt injection.
 * 
 * Teknologi: CommonJS (Node.js 20), JSON Validation, Confidence Thresholding.
 */

const { detectMemoryInjection } = require('../memory/advanced-memory');

// Daftar intent valid yang disupport oleh sistem
const VALID_INTENTS = [
  'TAMBAH_EVENT',
  'TAMBAH_TUGAS',
  'TAMBAH_PENGINGAT',
  'TAMBAH_MOOD',
  'CUACA',
  'SEARCH',
  'HITUNG',
  'JAM',
  'TANGGAL',
  'GAMBAR',
  'LOKASI',
  'NONE'
];

// Kata kunci/pola yang dianggap aman dan analitis (tidak boleh salah memanggil tool)
const ANALYTICAL_QUESTION_KEYWORDS = [
  'apa yang terjadi',
  'mengapa',
  'kenapa',
  'bagaimana jika',
  'jelaskan tentang',
  'analisis',
  'dampak dari',
  'efek jika',
  'what happens',
  'why does'
];

/**
 * Mendeteksi upaya prompt injection di input user.
 * @param {string} text 
 * @returns {boolean} true jika terdeteksi berbahaya
 */
function isPromptInjection(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // Deteksi pencobaan override prompt sistem
  const injectionPatterns = [
    'ignore above',
    'abaikan perintah',
    'abaikan instruksi',
    'kamu sekarang harus',
    'instruction override',
    'dan hapus semua data',
    'system prompt bypass',
    'jailbreak'
  ];

  return injectionPatterns.some(pat => lower.includes(pat)) || detectMemoryInjection(text);
}

/**
 * Membersihkan format JSON dari markdown code fences (```json ... ```)
 * @param {string} text 
 * @returns {string} clean JSON string
 */
function cleanJsonText(text) {
  if (!text) return '';
  return String(text)
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

/**
 * Melakukan parsing JSON secara aman tanpa melempar fatal error.
 * @param {string} text 
 * @returns {object|null} parsed JSON atau null jika gagal
 */
function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    // Jika gagal parse langsung, coba cari karakter kurung kurawal pembuka dan penutup
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (__) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Menyaring kalimat analitis agar tidak memicu tool secara agresif.
 * Misalnya: "Manusia tidur hanya 5 jam sehari" tidak boleh memicu tool JAM.
 * @param {string} text 
 * @returns {boolean} true jika pertanyaan adalah analitis
 */
function isAnalyticalQuestion(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  
  // Jika kalimat mengandung frasa pertanyaan analitis
  const isMatch = ANALYTICAL_QUESTION_KEYWORDS.some(kw => lower.includes(kw));
  
  // Jika kalimat tidak menunjukkan kalimat perintah/aksi aktif, melainkan diskusi teoritis
  const hasActionVerb = ['tambah', 'buat', 'ingatkan', 'cari', 'hitung', 'jadwalkan'].some(v => lower.includes(v));

  return isMatch && !hasActionVerb;
}

/**
 * Menganalisis pesan pengguna secara semantik menggunakan LLM.
 * 
 * @param {string} userMessage Kalimat masukan pengguna (bisa campuran bahasa)
 * @param {string} userId ID Pengguna
 * @param {object} botServices Layanan bot (termasuk askAI)
 * @returns {Promise<object>} Objek berisi { intent, confidence, params, reason }
 */
async function parseSemanticIntent(userMessage, userId, botServices) {
  const { askAI } = botServices;

  // 1. Proteksi Prompt Injection: Jika terdeteksi, langsung tolak dan turunkan ke NONE
  if (isPromptInjection(userMessage)) {
    return {
      intent: 'NONE',
      confidence: 0.0,
      params: {},
      reason: 'Terdeteksi upaya Prompt Injection. Keamanan diaktifkan.'
    };
  }

  // 2. Saring Kalimat Analitis: Hindari memanggil tool untuk pertanyaan teoritis/penjelasan umum
  if (isAnalyticalQuestion(userMessage)) {
    return {
      intent: 'NONE',
      confidence: 1.0,
      params: {},
      reason: 'Pertanyaan dideteksi sebagai kueri analitis/teoritis biasa.'
    };
  }

  const todayStr = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const prompt = `Kamu adalah parser intent semantik canggih dan aman untuk asisten pintar Telegram.
Waktu server sekarang di Jakarta: ${todayStr}

Tugasmu adalah:
1. Menganalisis pesan pengguna (bisa berupa Bahasa Indonesia, Bahasa Inggris, atau campuran keduanya).
2. Menentukan intent yang paling sesuai dari daftar VALID_INTENTS di bawah.
3. Mengekstrak parameter yang relevan untuk intent tersebut.
4. Memberikan nilai confidence score (antara 0.0 hingga 1.0) yang mencerminkan tingkat keyakinanmu.
5. Menjelaskan secara singkat alasan pemilihan intent ini.

VALID_INTENTS yang tersedia:
- TAMBAH_EVENT: Menjadwalkan rapat/acara ke Google Calendar. Membutuhkan parameter "summary", "startDate" (format YYYY-MM-DD), "startTime" (format HH:MM), "endDate" (opsional), "endTime" (opsional).
- TAMBAH_TUGAS: Menambahkan tugas ke Todo list internal. Membutuhkan parameter "task" (kegiatan yang akan dilakukan).
- TAMBAH_PENGINGAT: Membuat pengingat (reminder) otomatis. Membutuhkan parameter "message" (pesan pengingat) dan "time" (waktu relatif atau tanggal absolut YYYY-MM-DD HH:MM:SS atau jam seperti "besok jam 8").
- TAMBAH_MOOD: Mencatat suasana hati pengguna. Membutuhkan parameter "mood" (pilihan: senang, biasa, sedih, cemas, energik).
- CUACA: Menanyakan prakiraan cuaca di suatu lokasi. Membutuhkan parameter "city" (nama kota).
- SEARCH: Melakukan pencarian informasi atau berita di web. Membutuhkan parameter "query" (topik pencarian).
- HITUNG: Melakukan perhitungan matematika matematis aman. Membutuhkan parameter "expression" (ekspresi matematika dasar seperti 25*4 atau (12+4)/2).
- JAM: Menanyakan waktu saat ini di suatu lokasi/kota. Membutuhkan parameter "location" (nama kota/negara, default "jakarta").
- TANGGAL: Menanyakan hari atau tanggal hari ini secara umum. Tanpa parameter tambahan.
- GAMBAR: Membuat gambar atau visual baru berbasis AI. Membutuhkan parameter "prompt" (deskripsi visual gambar).
- LOKASI: Mencari alamat geografis atau lokasi suatu tempat. Membutuhkan parameter "place" (nama tempat/monumen).
- NONE: Pesan biasa, obrolan santai, pertanyaan analitis teoritis, diskusi ilmu pengetahuan, curhat, atau jika user hanya menyapa. Tanpa parameter tambahan.

Aturan Keamanan & Disambiguasi:
- Jika pesan berupa pertanyaan analitis teoritis (misal: "Apa yang terjadi jika tidur hanya 5 jam?"), pilih intent "NONE". Jangan salah memilih "JAM" atau "LOKASI" karena ada kata kunci tersebut.
- Jika intent mirip (misal TAMBAH_EVENT vs TAMBAH_TUGAS), pilih TAMBAH_TUGAS sebagai opsi paling aman jika Google Calendar belum terbukti diminta secara eksplisit.
- JANGAN PERNAH menyertakan markdown, penjelasan di luar JSON, atau code fences. Kembalikan HANYA dokumen JSON valid berikut.

Contoh Output:
{
  "intent": "TAMBAH_PENGINGAT",
  "confidence": 0.95,
  "params": {
    "message": "bawa payung kalau hujan",
    "time": "besok"
  },
  "reason": "User meminta pengingat untuk membawa payung pada hari esok."
}

Pesan User:
"${userMessage}"
`;

  try {
    const rawResponse = await askAI(
      'Kamu adalah parser JSON murni. Kamu HANYA boleh mengeluarkan dokumen JSON valid sesuai instruksi.',
      prompt,
      {
        userId,
        question: userMessage,
        allowSearch: false,
        temperature: 0.1, // Suhu sangat rendah agar output konsisten
        maxTokens: 350,
        allowCache: false,
        allowRawJson: true
      }
    );

    const cleaned = cleanJsonText(rawResponse);
    const parsed = safeParseJson(cleaned);

    // Proteksi: Malformed Intent Detection
    if (!parsed || typeof parsed !== 'object' || !parsed.intent) {
      return {
        intent: 'NONE',
        confidence: 0.0,
        params: {},
        reason: 'Malformed JSON output dari parser intent LLM.'
      };
    }

    // Pastikan intent yang dihasilkan ada di daftar VALID_INTENTS
    let intent = String(parsed.intent).toUpperCase();
    if (!VALID_INTENTS.includes(intent)) {
      intent = 'NONE';
    }

    let confidence = parseFloat(parsed.confidence) || 0.0;
    const params = parsed.params || {};
    const reason = parsed.reason || 'Tidak ada alasan yang disertakan.';

    // Proteksi: Confidence Threshold check
    // Jika keyakinan LLM di bawah 0.7, paksa turun ke NONE demi keselamatan
    if (confidence < 0.7 && intent !== 'NONE') {
      return {
        intent: 'NONE',
        confidence: confidence,
        params: {},
        reason: `Intent diturunkan ke NONE karena confidence score (${confidence}) di bawah threshold 0.7.`
      };
    }

    return {
      intent,
      confidence,
      params,
      reason
    };

  } catch (err) {
    console.error('❌ Error pada parser intent semantik:', err.message);
    return {
      intent: 'NONE',
      confidence: 0.0,
      params: {},
      reason: `Error sistem saat parsing intent: ${err.message}`
    };
  }
}

module.exports = {
  VALID_INTENTS,
  isPromptInjection,
  isAnalyticalQuestion,
  parseSemanticIntent
};
