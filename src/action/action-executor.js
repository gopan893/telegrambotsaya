/**
 * Natural Language Action & Tool-Calling Executor
 * Mengeksekusi API / fungsi asisten berdasarkan intent dan parameter semantik yang telah divalidasi.
 * Mengimplementasikan Tool Misuse Protection dan Unsafe Action Prevention.
 * 
 * Teknologi: CommonJS (Node.js 20), Sandboxed input validation.
 */

const { updateSessionState } = require('../memory/advanced-memory');

/**
 * Validasi ekspresi matematika dasar secara ketat untuk mencegah code injection.
 * @param {string} expr 
 * @returns {boolean} true jika aman
 */
function isSafeMathExpression(expr) {
  if (!expr || typeof expr !== 'string') return false;
  // Hanya izinkan angka, operator matematika dasar (+, -, *, /, %, (, ), .), dan spasi
  const safePattern = /^[0-9+\-*/().%\s]+$/;
  if (!safePattern.test(expr)) return false;
  
  // Hindari pengulangan operator ganda yang aneh seperti ** atau //
  if (/\*\*|\/{2,}/.test(expr)) return false;

  return true;
}

/**
 * Mengeksekusi aksi/tool berdasarkan intent dan parameter semantik secara aman.
 * 
 * @param {string} intent Intent yang divalidasi (misal TAMBAH_TUGAS, CUACA)
 * @param {object} params Parameter yang diekstrak
 * @param {string} chatId ID obrolan Telegram
 * @param {string} userId ID pengguna Telegram
 * @param {object} msgObj Objek pesan Telegram asli
 * @param {object} botServices Objek layanan Telegram dari telebot.js
 * @returns {Promise<object>} Laporan status eksekusi { toolExecuted, ok, resultText, error, params }
 */
async function executeSemanticAction(intent, params, chatId, userId, msgObj, botServices) {
  const { 
    safeSendMessage, 
    sendChunkedMessage,
    getWeather, 
    searchLocation, 
    summarizeSearchWithRefs,
    generateImage, 
    sendPhotoUrl,
    getCalendarClient,
    ensureUser,
    persist
  } = botServices;

  const u = ensureUser(userId);

  console.log(`🤖 Memulai eksekusi aksi semantik: ${intent} untuk user ${userId}`);

  try {
    switch (intent) {
      case 'TAMBAH_TUGAS': {
        const task = String(params.task || '').trim();
        if (!task) {
          return { toolExecuted: intent, ok: false, error: 'Nama tugas kosong atau tidak jelas.', params };
        }
        
        u.todos.push({
          text: task,
          done: false,
          createdAt: Date.now()
        });

        await persist();
        const msg = `✅ Tugas **"${task}"** berhasil ditambahkan ke daftar Todo-mu.`;
        await safeSendMessage(chatId, msg, { reply_to_message_id: msgObj.message_id });
        
        return { toolExecuted: intent, ok: true, resultText: msg, params };
      }

      case 'TAMBAH_PENGINGAT': {
        const message = String(params.message || 'Pengingat Tanpa Judul').trim();
        const timeValue = String(params.time || '').trim();

        if (!timeValue) {
          return { toolExecuted: intent, ok: false, error: 'Waktu pengingat kosong.', params };
        }

        // Jalankan penjadwalan reminder dari telebot.js
        const { scheduleReminderFromParams } = botServices;
        if (typeof scheduleReminderFromParams !== 'function') {
          throw new Error('Metode scheduleReminderFromParams tidak terdaftar di botServices.');
        }

        const scheduled = await scheduleReminderFromParams(chatId, userId, message, timeValue, msgObj);
        if (scheduled) {
          const msg = `✅ Pengingat untuk "${message}" berhasil dijadwalkan pada "${timeValue}".`;
          return { toolExecuted: intent, ok: true, resultText: msg, params };
        } else {
          return { toolExecuted: intent, ok: false, error: 'Format waktu pengingat gagal diparse.', params };
        }
      }

      case 'CUACA': {
        const city = String(params.city || '').trim();
        if (!city) {
          return { toolExecuted: intent, ok: false, error: 'Nama kota untuk ramalan cuaca kosong.', params };
        }

        const weatherReport = await getWeather(city);
        await safeSendMessage(chatId, weatherReport, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: weatherReport, params };
      }

      case 'LOKASI': {
        const place = String(params.place || '').trim();
        if (!place) {
          return { toolExecuted: intent, ok: false, error: 'Nama tempat pencarian lokasi kosong.', params };
        }

        const locationReport = await searchLocation(place);
        await safeSendMessage(chatId, locationReport, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: locationReport, params };
      }

      case 'HITUNG': {
        const expr = String(params.expression || '').trim();
        if (!expr) {
          return { toolExecuted: intent, ok: false, error: 'Ekspresi matematika kosong.', params };
        }

        // Proteksi Tool Misuse & Code Injection
        if (!isSafeMathExpression(expr)) {
          const errText = '❌ Ekspresi matematika dideteksi mengandung karakter berbahaya!';
          await safeSendMessage(chatId, errText, { reply_to_message_id: msgObj.message_id });
          return { toolExecuted: intent, ok: false, error: 'Ekspresi matematika tidak aman.', params };
        }

        const { calculate } = botServices;
        const calcResult = calculate(expr);
        await safeSendMessage(chatId, calcResult, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: calcResult, params };
      }

      case 'JAM': {
        const location = String(params.location || 'jakarta').trim();
        const { getCurrentTime } = botServices;
        
        const timeReport = getCurrentTime(location);
        await safeSendMessage(chatId, timeReport, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: timeReport, params };
      }

      case 'TANGGAL': {
        const { getCurrentDate } = botServices;
        const dateReport = getCurrentDate();
        await safeSendMessage(chatId, dateReport, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: dateReport, params };
      }

      case 'GAMBAR': {
        const prompt = String(params.prompt || '').trim();
        if (!prompt) {
          return { toolExecuted: intent, ok: false, error: 'Prompt gambar kosong.', params };
        }

        await safeSendMessage(chatId, `🎨 Membuat gambar semantik untukmu: "${prompt}"...`);
        const imgUrl = await generateImage(prompt);
        const ok = await sendPhotoUrl(chatId, imgUrl, `✨ ${prompt}`, { reply_to_message_id: msgObj.message_id });
        
        if (ok) {
          return { toolExecuted: intent, ok: true, resultText: `Gambar berhasil dikirim: ${prompt}`, params };
        } else {
          return { toolExecuted: intent, ok: false, error: 'Gagal mengirim gambar.', params };
        }
      }

      case 'SEARCH': {
        const query = String(params.query || '').trim();
        if (!query) {
          return { toolExecuted: intent, ok: false, error: 'Kueri pencarian kosong.', params };
        }

        const searchResult = await summarizeSearchWithRefs(query, userId, botServices.getSystemPrompt(userId));
        await sendChunkedMessage(chatId, searchResult, { reply_to_message_id: msgObj.message_id, disable_web_page_preview: true });

        return { toolExecuted: intent, ok: true, resultText: searchResult, params };
      }

      case 'TAMBAH_EVENT': {
        const summary = String(params.summary || 'Acara Baru').trim();
        const startDate = String(params.startDate || '').trim();
        const startTime = String(params.startTime || '09:00').trim();
        const endDate = String(params.endDate || startDate).trim();
        const endTime = String(params.endTime || '10:00').trim();

        if (!startDate) {
          return { toolExecuted: intent, ok: false, error: 'Tanggal mulai event kalender tidak ditentukan.', params };
        }

        const calendar = await getCalendarClient(userId);
        if (!calendar) {
          const warnMsg = '❌ Google Calendar belum terautentikasi. Silakan ketik `/auth` terlebih dahulu.';
          await safeSendMessage(chatId, warnMsg, { reply_to_message_id: msgObj.message_id });
          return { toolExecuted: intent, ok: false, error: 'Calendar unauthorized.', params };
        }

        const { parseFlexibleDateTime, isValidDate } = botServices;
        const startDT = parseFlexibleDateTime(`${startDate} ${startTime}`, '09:00');
        const endDT = parseFlexibleDateTime(`${endDate} ${endTime}`, '10:00') ||
                      (startDT ? new Date(startDT.getTime() + 60 * 60 * 1000) : null);

        if (!isValidDate(startDT) || !isValidDate(endDT)) {
          const errText = '❌ Format tanggal atau waktu acara kalender tidak valid.';
          await safeSendMessage(chatId, errText, { reply_to_message_id: msgObj.message_id });
          return { toolExecuted: intent, ok: false, error: 'Format tanggal ilegal.', params };
        }

        // Panggil Google Calendar API
        await calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary,
            start: { dateTime: startDT.toISOString(), timeZone: 'Asia/Jakarta' },
            end: { dateTime: endDT.toISOString(), timeZone: 'Asia/Jakarta' }
          }
        });

        const successMsg = `✅ Acara **"${summary}"** berhasil ditambahkan ke Google Calendar Anda.`;
        await safeSendMessage(chatId, successMsg, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: successMsg, params };
      }

      case 'TAMBAH_MOOD': {
        const mood = String(params.mood || '').toLowerCase().trim();
        const validMoods = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];
        
        if (!validMoods.includes(mood)) {
          const errText = '❌ Mood tidak dikenali. Pilihan: senang, biasa, sedih, cemas, energik.';
          await safeSendMessage(chatId, errText, { reply_to_message_id: msgObj.message_id });
          return { toolExecuted: intent, ok: false, error: 'Mood invalid.', params };
        }

        u.mood = mood;
        u.lastMoodUpdate = Date.now();
        await persist();

        const successMsg = `📝 Suasana hatimu hari ini tercatat sebagai **"${mood}"**.`;
        await safeSendMessage(chatId, successMsg, { reply_to_message_id: msgObj.message_id });

        return { toolExecuted: intent, ok: true, resultText: successMsg, params };
      }

      default:
        return { toolExecuted: intent, ok: false, error: 'Intent tidak disupport oleh Executor.', params };
    }
  } catch (err) {
    console.error(`❌ Gagal mengeksekusi tool ${intent}:`, err.message);
    return { toolExecuted: intent, ok: false, error: err.message, params };
  }
}

module.exports = {
  isSafeMathExpression,
  executeSemanticAction
};
