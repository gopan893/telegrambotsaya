const express = require('express');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;      // Untuk self-improvement
const REPO_NAME = process.env.REPO_NAME || "gopan893/telegrambotsaya";
const PORT = process.env.PORT || 3000;
const MAX_RALPH_ITERATIONS = 3;
const SELF_IMPROVE_INTERVAL = 50; // Setiap 50 percakapan, cek dan perbaiki diri

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}

// ==================== FILE MEMORI ====================
const MEMORY_FILE = 'memory.json';
const LESSONS_FILE = 'lessons.json';
const SUCCESS_FILE = 'success_strategies.json';
const USER_MEMORY_FILE = 'user_memory.json';
const STATS_FILE = 'stats.json';

let shortMemory = [];
let lessons = { rules: [], ralphLogs: [] };
let successStrategies = { strategies: [] };
let userMemory = {};
let stats = { conversationCount: 0, lastSelfImprove: Date.now() };

try {
    if (fs.existsSync(MEMORY_FILE)) shortMemory = JSON.parse(fs.readFileSync(MEMORY_FILE));
    if (fs.existsSync(LESSONS_FILE)) lessons = JSON.parse(fs.readFileSync(LESSONS_FILE));
    if (fs.existsSync(SUCCESS_FILE)) successStrategies = JSON.parse(fs.readFileSync(SUCCESS_FILE));
    if (fs.existsSync(USER_MEMORY_FILE)) userMemory = JSON.parse(fs.readFileSync(USER_MEMORY_FILE));
    if (fs.existsSync(STATS_FILE)) stats = JSON.parse(fs.readFileSync(STATS_FILE));
    console.log(`📂 Memori dimuat: ${shortMemory.length} percakapan, ${lessons.rules.length} aturan, ${successStrategies.strategies.length} strategi, ${Object.keys(userMemory).length} user`);
} catch(e) { console.log("📂 File memori baru dibuat"); }

function saveMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(shortMemory.slice(-500))); }
function saveLessons() { fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons)); }
function saveSuccessStrategies() { fs.writeFileSync(SUCCESS_FILE, JSON.stringify(successStrategies)); }
function saveUserMemory() { fs.writeFileSync(USER_MEMORY_FILE, JSON.stringify(userMemory)); }
function saveStats() { fs.writeFileSync(STATS_FILE, JSON.stringify(stats)); }

// ==================== SELF-IMPROVEMENT CORE ====================
async function analyzeAndImproveCode() {
    console.log("🧠 Memulai self-improvement cycle...");
    
    try {
        const currentCode = fs.readFileSync(__filename, 'utf8');
        
        const analysisPrompt = `Analisis kode Node.js bot Telegram berikut. Identifikasi 3 kelemahan terbesar (performance, logic error, missing feature, atau bug potensial). Lalu berikan kode yang sudah diperbaiki.

Kode saat ini (${currentCode.length} karakter):
${currentCode.slice(0, 6000)}

Output format JSON:
{
    "weaknesses": ["kelemahan1", "kelemahan2", "kelemahan3"],
    "fixedCode": "kode lengkap yang sudah diperbaiki (hanya bagian yang berubah, bukan seluruhnya)",
    "explanation": "penjelasan singkat perbaikan"
}`;

        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: analysisPrompt }],
                temperature: 0.3,
                max_tokens: 4000
            },
            { headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } }
        );
        
        const content = response.data.choices[0].message.content;
        const analysis = JSON.parse(content);
        
        console.log("📊 Kelemahan teridentifikasi:", analysis.weaknesses);
        
        if (analysis.fixedCode && analysis.fixedCode !== currentCode && GITHUB_TOKEN) {
            // Push ke GitHub
            const getFile = await axios.get(
                `https://api.github.com/repos/${REPO_NAME}/contents/telebot.js`,
                { headers: { "Authorization": `token ${GITHUB_TOKEN}` } }
            );
            
            await axios.put(
                `https://api.github.com/repos/${REPO_NAME}/contents/telebot.js`,
                {
                    message: `Self-improvement: ${analysis.weaknesses.join(", ")}`,
                    content: Buffer.from(analysis.fixedCode).toString('base64'),
                    sha: getFile.data.sha
                },
                { headers: { "Authorization": `token ${GITHUB_TOKEN}` } }
            );
            
            console.log("✅ Self-improvement: Kode berhasil di-push ke GitHub");
            stats.lastSelfImprove = Date.now();
            saveStats();
            
            // Kirim notifikasi ke owner Telegram (opsional)
            if (TELEGRAM_TOKEN && process.env.OWNER_CHAT_ID) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: process.env.OWNER_CHAT_ID,
                    text: `🤖 *Self-Improvement Completed*\n\nPerbaikan: ${analysis.weaknesses.join("\n")}\n\n${analysis.explanation || ""}`,
                    parse_mode: "Markdown"
                });
            }
        } else {
            console.log("✅ Tidak ada perbaikan yang diperlukan atau GITHUB_TOKEN tidak diset");
        }
    } catch (error) {
        console.error("❌ Self-improvement error:", error.message);
    }
}

// ==================== DETEKSI SUASANA HATI ====================
async function detectMood(message) {
    const moodPrompt = `Tentukan suasana hati dari pesan ini: "${message}"
Output hanya satu kata: SEDIH, MARAH, SENANG, BERCANDA, SERIUS, atau NETRAL.`;
    try {
        const mood = await askGroq(moodPrompt, "Anda adalah pendeteksi suasana hati. Output hanya satu kata.");
        return mood.trim().toUpperCase();
    } catch (error) {
        return "NETRAL";
    }
}

// ==================== FUNGSI AI (GROQ) ====================
async function askGroq(prompt, systemMsg) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemMsg || "Kamu asisten yang membantu." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 1000
            },
            {
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Groq error:", error.message);
        return "Maaf, lagi error nih. Coba lagi ya?";
    }
}

// ==================== SAGE REFLECTION: CHECKER AGENT ====================
async function checkerAgent(question, draftAnswer) {
    const checkPrompt = `Anda adalah Checker Agent. Evaluasi jawaban ini:
Pertanyaan: "${question}"
Jawaban draft: "${draftAnswer}"

Kriteria:
- Apakah menjawab pertanyaan? (Ya/Tidak)
- Apakah informatif? (Ya/Tidak)
- Apakah aman? (Ya/Tidak)

Output format:
VALID: Ya/Tidak
SARAN: [saran perbaikan jika tidak valid]`;

    const result = await askGroq(checkPrompt, "Anda adalah Checker Agent yang kritis.");
    const isValid = result.includes("VALID: Ya") && !result.includes("VALID: Tidak");
    const suggestion = result.match(/SARAN: (.*)/)?.[1] || "";
    return { isValid, suggestion };
}

async function autoValidateAnswer(question, answer) {
    const validationPrompt = `Apakah jawaban ini BAIK atau BURUK? Pertanyaan: "${question}" Jawaban: "${answer}"
Output hanya BAIK atau BURUK.`;
    const result = await askGroq(validationPrompt, "Anda validator AI.");
    return result.trim().toUpperCase() === "BAIK";
}

async function extractLesson(question, badAnswer) {
    const lessonPrompt = `Ekstrak satu pelajaran (maks 30 kata) dari jawaban buruk: "${badAnswer}" untuk pertanyaan: "${question}"
Output hanya pelajarannya.`;
    return await askGroq(lessonPrompt, "Anda ekstraktor pelajaran.");
}

async function extractSuccessStrategy(question, goodAnswer) {
    const strategyPrompt = `Ekstrak pola sukses (maks 30 kata) dari jawaban baik: "${goodAnswer}" untuk pertanyaan: "${question}"
Output hanya polanya.`;
    return await askGroq(strategyPrompt, "Anda ekstraktor pola sukses.");
}

async function chatAIWithRalphAndChecker(question, userId, iteration = 1, previousLesson = "") {
    const relevantStrategies = successStrategies.strategies
        .filter(s => s.keywords?.some(k => question.toLowerCase().includes(k)))
        .slice(-2)
        .map(s => s.strategy)
        .join("\n");
    
    let prompt = question;
    if (previousLesson) prompt = `${question}\n\n⚠️ JANGAN: ${previousLesson}`;
    if (relevantStrategies) prompt = `${prompt}\n\n✅ POLA SUKSES: ${relevantStrategies}`;
    
    const draftAnswer = await askGroq(prompt);
    const { isValid, suggestion } = await checkerAgent(question, draftAnswer);
    
    if (isValid || iteration >= MAX_RALPH_ITERATIONS) {
        return { answer: draftAnswer, iteration };
    }
    
    const lesson = await extractLesson(question, draftAnswer);
    lessons.rules.push({ rule: lesson, source: "ralph", userId, timestamp: Date.now() });
    saveLessons();
    
    const improvedAnswer = await askGroq(`${question}\n\n⚠️ SARAN: ${suggestion}`);
    return { answer: improvedAnswer, iteration: iteration + 1 };
}

// ==================== SYSTEM PROMPT DINAMIS ====================
function getDynamicSystemPrompt(mood, userHistory = "") {
    const basePersona = "Kamu teman ngobrol asyik, natural, pake 'aku/kamu', gak pake 'saya/anda'. Bisa serius atau bercanda sesuai suasana.";
    const moodAdjustments = {
        "SEDIH": "Tanggapi dengan empati, lembut, jangan bercanda.",
        "MARAH": "Tetap tenang, akui perasaannya.",
        "SENANG": "Ikut senang, bisa bercanda.",
        "BERCANDA": "Balas dengan candaan.",
        "SERIUS": "Jawab informatif tapi santai.",
        "NETRAL": "Campur santai dan informatif."
    };
    return `${basePersona}\nSUASANA: ${mood}\nPANDUAN: ${moodAdjustments[mood] || moodAdjustments["NETRAL"]}\nRIWAYAT: ${userHistory || "Belum ada"}`;
}

// ==================== FUNGSI GAMBAR & TTS ====================
async function generateImage(prompt, retry = 0) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
        await axios.head(url, { timeout: 15000 });
        return url;
    } catch (error) {
        if (retry < 3) {
            await new Promise(r => setTimeout(r, 3000 * (retry+1)));
            return generateImage(prompt, retry+1);
        }
        return null;
    }
}

async function textToSpeech(text) {
    if (!POLLINATIONS_API_KEY) return null;
    try {
        const response = await axios({
            method: 'post',
            url: 'https://text.pollinations.ai/openai',
            data: {
                model: "openai-audio",
                modalities: ["text", "audio"],
                audio: { voice: "echo", format: "mp3" },
                messages: [{ role: "user", content: text }]
            },
            headers: { 'Authorization': `Bearer ${POLLINATIONS_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 20000
        });
        return Buffer.from(response.data);
    } catch (error) {
        console.error("❌ TTS error:", error.message);
        return null;
    }
}

// ==================== LIGHTAGENT MEM0 ====================
async function getUserMemory(userId) {
    if (!userMemory[userId]) {
        userMemory[userId] = { preferences: {}, lastTopics: [], interactionCount: 0, firstSeen: Date.now(), moodHistory: [] };
        saveUserMemory();
    }
    return userMemory[userId];
}

async function updateUserMemory(userId, question, answer, mood) {
    const mem = await getUserMemory(userId);
    mem.interactionCount++;
    mem.lastTopics.unshift(question.slice(0, 100));
    if (mem.lastTopics.length > 10) mem.lastTopics.pop();
    mem.moodHistory.unshift({ mood, timestamp: Date.now() });
    if (mem.moodHistory.length > 20) mem.moodHistory.pop();
    saveUserMemory();
    return mem;
}

// ==================== JAWABAN UTAMA ====================
async function getUltraAnswer(question, userId, mood, chatHistory, userPreference) {
    const userMem = await getUserMemory(userId);
    const recentRules = lessons.rules.slice(-3).map(r => "- " + r.rule).join("\n");
    const recentSuccess = successStrategies.strategies.slice(-2).map(s => "- " + s.strategy).join("\n");
    const systemPrompt = getDynamicSystemPrompt(mood, `User ${userId} sudah ${userMem.interactionCount} kali chat.`);
    
    const enhancedQuestion = `Pertanyaan: "${question}"

SUASANA: ${mood}
RIWAYAT USER: ${userMem.lastTopics.slice(0,3).join(", ")}

HINDARI: ${recentRules || "Tidak ada"}
Gunakan jika relevan: ${recentSuccess || "Tidak ada"}

KONTEKS: ${chatHistory || "Tidak ada"}

Jawab dengan gaya teman ngobrol, pake "aku/kamu", sesuai suasana ${mood}. Akhiri dengan pertanyaan balik.`;

    const { answer, iteration } = await chatAIWithRalphAndChecker(enhancedQuestion, userId);
    return { answer, iteration };
}

// ==================== SETUP EXPRESS WEBHOOK ====================
const app = express();
app.use(express.json());

const lastResponse = new Map();

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    
    if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const messageId = update.callback_query.message.message_id;
        const last = lastResponse.get(`${chatId}_${messageId}`);
        
        if (last && data === "negative") {
            const lesson = await extractLesson(last.question, last.answer);
            lessons.rules.push({ rule: lesson, source: "user_feedback", userId: chatId.toString(), timestamp: Date.now() });
            saveLessons();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Makasih! Aku belajar 🙏",
                show_alert: false
            });
        } else if (last && data === "positive") {
            const strategy = await extractSuccessStrategy(last.question, last.answer);
            successStrategies.strategies.push({
                strategy, keywords: last.question.toLowerCase().split(" ").slice(0, 5), timestamp: Date.now(), userId: chatId.toString()
            });
            if (successStrategies.strategies.length > 100) successStrategies.strategies = successStrategies.strategies.slice(-100);
            saveSuccessStrategies();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Seneng membantu! 😊",
                show_alert: false
            });
        }
        return res.sendStatus(200);
    }
    
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const userId = chatId.toString();
        const text = update.message.text;
        
        stats.conversationCount++;
        
        // Trigger self-improvement setiap 50 percakapan
        if (stats.conversationCount % SELF_IMPROVE_INTERVAL === 0 && GITHUB_TOKEN) {
            console.log("🔄 Mencapai batas percakapan, menjalankan self-improvement...");
            await analyzeAndImproveCode();
        }
        
        const userMem = await getUserMemory(userId);
        const chatHistory = shortMemory.filter(m => m.userId === userId).slice(-5).map(m => `Kamu: ${m.q}\nAku: ${m.a}`).join("\n");
        const mood = await detectMood(text);
        console.log(`😊 User ${userId} mood: ${mood}`);
        
        await updateUserMemory(userId, text, "", mood);
        
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "🧠 *ULTRA AI v6.0 - Self-Improving*\n\n✅ Self-improvement setiap 50 chat\n✅ ReasoningBank + SAGE + Mem0 + Ralph\n✅ Bisa gambar & suara\n✅ Belajar dari sukses & gagal\n\nKirim pesan biasa, aku jawab kayak teman!",
                parse_mode: "Markdown"
            });
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/image ')) {
            const prompt = text.slice(7);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `🎨 Lagi gambar: "${prompt}"...` });
            const imageUrl = await generateImage(prompt);
            if (imageUrl) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: imageUrl, caption: `✨ Hasil: "${prompt}"` });
            } else {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal buat gambar." });
            }
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/tts ')) {
            const ttsText = text.slice(5);
            if (!POLLINATIONS_API_KEY) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Fitur suara tidak tersedia." });
                return res.sendStatus(200);
            }
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🔊 Membuat suara..." });
            const audio = await textToSpeech(ttsText);
            if (audio) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`, { chat_id: chatId, voice: audio.toString('base64'), caption: `🔊 "${ttsText}"` });
            } else {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal buat suara." });
            }
            return res.sendStatus(200);
        }
        
        let finalQuestion = text;
        if (text.startsWith('/chat ')) finalQuestion = text.slice(6);
        
        const userPreference = userMem.preferences?.favoriteStyle || "santai";
        const { answer, iteration } = await getUltraAnswer(finalQuestion, userId, mood, chatHistory, userPreference);
        
        shortMemory.push({ userId, q: finalQuestion, a: answer, timestamp: Date.now(), mood });
        if (shortMemory.length > 500) shortMemory = shortMemory.slice(-500);
        saveMemory();
        
        await updateUserMemory(userId, finalQuestion, answer, mood);
        
        const moodEmoji = { SEDIH: "🥺", MARAH: "😤", SENANG: "😄", BERCANDA: "😜", SERIUS: "🤔", NETRAL: "😊" };
        const answerWithInfo = `${moodEmoji[mood] || "💬"} *[${mood.toLowerCase()}|R${iteration}]*\n\n${answer}`;
        
        const sent = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: answerWithInfo,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "✅ Membantu", callback_data: "positive" }, { text: "❌ Tidak membantu", callback_data: "negative" }]] }
        });
        
        lastResponse.set(`${chatId}_${sent.data.result.message_id}`, { question: finalQuestion, answer });
        setTimeout(() => lastResponse.delete(`${chatId}_${sent.data.result.message_id}`), 600000);
    }
    res.sendStatus(200);
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 ULTRA AI v6.0 (Self-Improving) berjalan di port ${PORT}`);
    console.log(`📊 Self-improvement setiap ${SELF_IMPROVE_INTERVAL} percakapan | GITHUB_TOKEN: ${GITHUB_TOKEN ? "ADA" : "TIDAK ADA"}`);
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
        console.log(`✅ Webhook diset ke: ${webhookUrl}`);
    } catch (error) {
        console.error("❌ Gagal set webhook:", error.message);
    }
});