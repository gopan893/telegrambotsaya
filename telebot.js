import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import os from 'node:os';

// Third-party libraries
import OpenAI, { toFile } from 'openai';
import { Telegraf } from 'telegraf';

// Dynamic import for optional heavy dependencies
let pdfParse;
try {
  pdfParse = (await import('pdf-parse')).default;
} catch {
  console.warn("⚠️ Module 'pdf-parse' belum diinstal. Fitur PDF terbatas.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. CONFIGURATION & ENVIRONMENT
// ==========================================
const config = {
  telegramToken: mustGetAnyEnv(['TELEGRAM_TOKEN', 'TELEGRAM_BOT_TOKEN']),
  aiProvider: (process.env.AI_PROVIDER || 'openai').toLowerCase(),
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  adminIds: new Set((process.env.OWNER_CHAT_ID || process.env.ADMIN_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)),
  rateLimitMessages: 20,
  rateLimitWindowMs: 60000,
  dataFile: path.join(__dirname, process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: path.join(__dirname, process.env.KNOWLEDGE_DIR || './knowledge'),
  port: process.env.PORT || 3000,
  // Integrasi
  notionApiKey: process.env.NOTION_API_KEY || '',
  notionDatabaseId: process.env.NOTION_DATABASE_ID || '',
};

// ==========================================
// 2. STATE MANAGEMENT & INFRASTRUCTURE
// ==========================================
let state = { 
  users: {}, 
  chats: {}, 
  metrics: { startedAt: new Date().toISOString(), messagesHandled: 0, spamBlocked: 0, errors: 0 },
  reminders: [],
  systemLogs: [] // Untuk Dashboard UI
};

function addLog(message) {
  const time = new Date().toLocaleTimeString();
  state.systemLogs.unshift(`[${time}] ${message}`);
  if (state.systemLogs.length > 50) state.systemLogs.pop();
}

async function saveState() {
  try {
    await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
    const tempFile = `${config.dataFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(state, null, 2));
    await fs.rename(tempFile, config.dataFile); 
  } catch (error) {
    console.error('Gagal menyimpan state:', error);
  }
}

async function initBot() {
  try {
    const raw = await fs.readFile(config.dataFile, 'utf8');
    state = { ...state, ...JSON.parse(raw) };
    if (!state.reminders) state.reminders = [];
    if (!state.systemLogs) state.systemLogs = [];
    state.metrics.startedAt = new Date().toISOString();
    addLog('System Rebooted successfully.');
  } catch {
    addLog('Creating new database state.');
  }
  await saveState();
}

// ==========================================
// 3. INITIALIZATION
// ==========================================
const bot = new Telegraf(config.telegramToken);
const openai = config.aiProvider === 'openai' ? new OpenAI({ apiKey: config.openaiKey }) : null;
const rateLimiter = new Map();

// ==========================================
// 4. SMART SCHEDULER & BACKGROUND TASKS
// ==========================================
setInterval(async () => {
  const now = Date.now();
  const pending = [];
  for (let r of state.reminders) {
    if (now >= r.triggerAt) {
      try { await bot.telegram.sendMessage(r.chatId, `⏰ *PENGINGAT:*\n${r.message}`, { parse_mode: 'Markdown' }); } 
      catch (e) { addLog(`Gagal mengirim reminder ke ${r.chatId}`); }
    } else pending.push(r);
  }
  if (state.reminders.length !== pending.length) {
    state.reminders = pending;
    await saveState();
  }
}, 60000);

// ==========================================
// 5. MIDDLEWARE: SMART FILTERING (ANTI-SPAM)
// ==========================================
bot.use(async (ctx, next) => {
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    const text = ctx.message?.text || ctx.message?.caption || '';
    // Deteksi indikasi spam/phising melalui keyword (Bisa diupgrade pakai AI Text Classification)
    const isSuspicious = /(http|www|t\.me)/i.test(text) && /(crypto|binance|investasi|free money|giveaway|jackpot|slot)/i.test(text);
    
    if (isSuspicious && !isAdmin(ctx)) {
      try {
        await ctx.deleteMessage();
        state.metrics.spamBlocked++;
        addLog(`Blocked spam message in group ${ctx.chat.id}`);
        return; // Hentikan eksekusi handler lain
      } catch (e) {
        addLog(`Failed to delete spam message (Not admin in group).`);
      }
    }
  }
  return next();
});

// ==========================================
// 6. TELEGRAM COMMANDS
// ==========================================
bot.start(async (ctx) => {
  touchUser(ctx);
  await ctx.reply(
    `🤖 *Omni-AI System Online*\n\n` +
    `Mode Tersedia:\n` +
    `1. Obrolan Biasa (Kirim teks/dokumen)\n` +
    `2. Multi-Agent Research (/research)\n` +
    `3. Alat Produktivitas (/run, /remind, /notion)\n\n` +
    `Ketik /help untuk manual lengkap.`,
    { parse_mode: 'Markdown' }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    `🌟 *OMNI-BOT FEATURES:*\n\n` +
    `🧠 *Multi-Agent (Tugas Berat):*\n` +
    `- /research <topik> : AI meneliti & menulis komprehensif.\n\n` +
    `🔗 *Integrasi & Alat:*\n` +
    `- /notion <teks> : Simpan ide ke Notion Workspace.\n` +
    `- /run <bahasa> <kode> : Eksekusi kode (JS, Python).\n` +
    `- /image <teks> : Buat ilustrasi DALL-E 3.\n\n` +
    `⏰ *Otomasi:*\n` +
    `- /remind <waktu> <pesan> : Contoh /remind 10m Rapat.\n\n` +
    `🔐 *Personalisasi:*\n` +
    `- /persona <sifat> : Ubah kepribadian bot.\n` +
    `- /memory : Lihat memori profil Anda.\n` +
    (isAdmin(ctx) ? `\n📊 /stats : Info Server Admin` : ''),
    { parse_mode: 'Markdown' }
  );
});

// Fitur Multi-Agent Workflow
bot.command('research', async (ctx) => {
  touchUser(ctx);
  const topic = getCommandPayload(ctx).trim();
  if (!topic) return ctx.reply('Sertakan topik. Contoh: `/research Potensi AI di bidang kesehatan 2025`', { parse_mode: 'Markdown' });

  const statusMsg = await ctx.reply('🕵️‍♂️ *Agent 1 (Perencana):* Sedang merancang kerangka riset...', { parse_mode: 'Markdown' });
  
  try {
    // Agent 1: Planning
    addLog(`Memulai Multi-Agent Workflow untuk topik: ${topic}`);
    const planPrompt = `Buat 3 poin utama yang harus dianalisis untuk topik: "${topic}". Cukup tulis poinnya saja.`;
    const plan = await generateText(planPrompt, 200);
    
    await bot.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `🕵️‍♂️ *Agent 1 Selesai.*\n\n👨‍🔬 *Agent 2 (Peneliti):* Mencari data dan melakukan web scraping untuk poin-poin tersebut...`, { parse_mode: 'Markdown' });
    
    // Agent 2: Research (Menggunakan Web Search / Ekstraksi Info)
    const researchPrompt = `Sebagai peneliti, berikan ringkasan data, fakta, atau argumen komprehensif untuk poin-poin berikut:\n${plan}\nGunakan pengetahuan terupdate.`;
    const researchData = await generateText(researchPrompt, 1500, true);

    await bot.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `👨‍🔬 *Agent 2 Selesai.*\n\n✍️ *Agent 3 (Penulis/Editor):* Menyusun laporan akhir...`, { parse_mode: 'Markdown' });

    // Agent 3: Writing & Polishing
    const writerPrompt = `Sebagai Editor ahli, rapikan data penelitian berikut menjadi laporan yang sangat mudah dibaca, profesional, lengkap dengan struktur pengantar, isi, dan kesimpulan menggunakan format Markdown yang rapi:\n\n${researchData}`;
    const finalReport = await generateText(writerPrompt, 2000);

    await safeDeleteMessage(ctx, statusMsg.message_id);
    await replyLong(ctx, `📑 *LAPORAN MULTI-AGENT*\n*Topik:* ${topic}\n\n${finalReport}`);
    addLog(`Multi-Agent Workflow selesai.`);
  } catch (err) {
    await safeDeleteMessage(ctx, statusMsg.message_id);
    await ctx.reply(`❌ Riset gagal: ${err.message}`);
  }
});

// Fitur Integrasi Notion
bot.command('notion', async (ctx) => {
  touchUser(ctx);
  const text = getCommandPayload(ctx).trim();
  if (!text) return ctx.reply('Format: `/notion [Tugas/Ide yang ingin disimpan]`', { parse_mode: 'Markdown' });

  if (!config.notionApiKey || !config.notionDatabaseId) {
    return ctx.reply('❌ API Key atau Database ID Notion belum dikonfigurasi di server (.env).');
  }

  const statusMsg = await ctx.reply('🔄 Menyinkronkan ke Notion Workspace...');
  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: config.notionDatabaseId },
        properties: {
          title: { title: [{ text: { content: text.substring(0, 50) + (text.length > 50 ? '...' : '') } }] }
        },
        children: [{
          object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] }
        }]
      })
    });

    if (!response.ok) throw new Error(await response.text());
    await bot.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '✅ *Berhasil disimpan ke Notion!*', { parse_mode: 'Markdown' });
    addLog(`Data synced to Notion by ${getUserId(ctx)}`);
  } catch (err) {
    await safeDeleteMessage(ctx, statusMsg.message_id);
    await ctx.reply(`❌ Gagal menyimpan ke Notion.`);
  }
});

// Command Tools Lainnya (Dari versi sebelumnya)
bot.command('remind', async (ctx) => { /* Logic Reminder seperti sebelumnya */ 
  const text = getCommandPayload(ctx).trim();
  const match = text.match(/^(\d+)([mh])\s+(.+)$/i);
  if (!match) return ctx.reply('Format: `/remind 10m Matikan kompor`', { parse_mode: 'Markdown' });
  const triggerAt = Date.now() + (parseInt(match[1]) * (match[2].toLowerCase() === 'h' ? 3600000 : 60000));
  state.reminders.push({ chatId: ctx.chat.id, message: match[3], triggerAt });
  await saveState();
  await ctx.reply(`✅ Pengingat disetel untuk: *"${match[3]}"*.`, { parse_mode: 'Markdown' });
});

bot.command('run', async (ctx) => { /* Code sandbox */ 
  const payload = getCommandPayload(ctx).trim();
  const firstSpace = payload.indexOf(' ');
  if (firstSpace === -1) return ctx.reply('Format: `/run <bahasa> <kode>`');
  const lang = payload.slice(0, firstSpace).toLowerCase();
  const code = payload.slice(firstSpace + 1).trim();
  const res = await fetch('https://emkc.org/api/v2/piston/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: lang, version: "*", files: [{ content: code }] }) });
  const result = await res.json();
  await ctx.reply(`*Output (${lang}):*\n\`\`\`text\n${result.run?.output || result.message}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.command('image', async (ctx) => { /* DALL-E */ 
  const prompt = getCommandPayload(ctx).trim();
  if(!prompt) return ctx.reply("Ketik deskripsi!");
  const res = await openai.images.generate({ model: "dall-e-3", prompt, size: "1024x1024" });
  await ctx.replyWithPhoto({ url: res.data[0].url }, { caption: `🎨 ${prompt}` });
});

bot.command('persona', async (ctx) => {
  const p = getCommandPayload(ctx).trim();
  getUserProfile(getUserId(ctx)).persona = p || null;
  await saveState();
  ctx.reply(p ? `✅ Persona diubah ke: ${p}` : `✅ Persona direset.`);
});

// ==========================================
// 7. CORE ENGINE (MEDIA, DOC, WEB, CHAT)
// ==========================================
bot.on(['text', 'photo', 'voice', 'document', 'video_note'], async (ctx) => {
  touchUser(ctx);
  if (!allowRequest(ctx)) return ctx.reply('⏳ Tunggu sebentar.');

  let messageText = extractMessageText(ctx);
  let contextData = '';
  
  ctx.sendChatAction('typing').catch(()=>{}); 
  const statusMsg = await ctx.reply('⏳ Menganalisis...').catch(()=>({message_id: null}));

  try {
    // Handle Voice/Video (Speech-to-Text via Whisper)
    if ((ctx.message.voice || ctx.message.video_note) && config.aiProvider === 'openai') {
      const fileId = ctx.message.voice?.file_id || ctx.message.video_note?.file_id;
      const link = await ctx.telegram.getFileLink(fileId);
      const res = await fetch(link.href);
      const file = await toFile(Buffer.from(await res.arrayBuffer()), 'media.ogg', { type: 'audio/ogg' });
      messageText = (await openai.audio.transcriptions.create({ file, model: 'whisper-1' })).text;
    }

    // Handle Document (PDF/TXT)
    if (ctx.message.document) {
      const doc = ctx.message.document;
      const link = await ctx.telegram.getFileLink(doc.file_id);
      const buf = Buffer.from(await (await fetch(link.href)).arrayBuffer());
      if (doc.file_name.endsWith('.pdf') && pdfParse) {
        contextData = (await pdfParse(buf)).text.substring(0, 15000);
      } else {
        contextData = buf.toString('utf-8').substring(0, 15000);
      }
      if (!messageText) messageText = "Tolong rangkum isi dokumen ini.";
    }

    // Handle URL Web Scraping
    const urls = messageText?.match(/https?:\/\/[^\s]+/g);
    if (urls && urls.length > 0) {
      await bot.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '🕸 Melakukan Web Scraping...');
      const html = await (await fetch(urls[0], { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
      contextData += `\n\n[WEB KONTEN]: ` + html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 15000);
    }

    if (!messageText && !ctx.message.photo && !contextData) throw new Error('Input tidak valid.');

    // RAG & Response Generation
    const localDb = await retrieveLocalKnowledge(messageText);
    const chat = getChatState(getChatId(ctx));
    const profile = getUserProfile(getUserId(ctx));
    
    let promptParts = [];
    if (messageText) promptParts.push(`User: ${messageText}`);
    if (contextData) promptParts.push(`Context Media/Web: ${contextData}`);
    if (localDb) promptParts.push(`Local DB: ${localDb}`);
    if (chat.recent.length) promptParts.push(`Chat History:\n${chat.recent.map(r=>`${r.role}: ${r.text}`).join('\n')}`);

    const sysInstruct = `Kamu adalah Sistem AI Otonom Omni-Level.${profile.persona ? ` Bertindak sebagai: ${profile.persona}` : ''}\nMemori User:\n${profile.memories.map(m=>m.text).join('\n')}`;

    let ans = '';
    const inputContent = [{ type: 'text', text: promptParts.join('\n\n') }];
    if (ctx.message.photo) {
      const imgLink = await ctx.telegram.getFileLink(ctx.message.photo.at(-1).file_id);
      inputContent.push({ type: 'image_url', image_url: { url: imgLink.href } });
    }

    if (config.aiProvider === 'openai') {
      const response = await openai.chat.completions.create({
        model: config.openaiModel,
        messages: [{ role: 'system', content: sysInstruct }, { role: 'user', content: inputContent }]
      });
      ans = response.choices[0].message.content;
    }

    rememberRecent(chat, 'user', messageText || '[Kirim Media/File]');
    rememberRecent(chat, 'assistant', ans);
    state.metrics.messagesHandled++;
    
    await safeDeleteMessage(ctx, statusMsg.message_id);
    await replyLong(ctx, ans);

    // Auto memory
    if (messageText && messageText.length > 15) {
      const mPrompt = `Ekstrak fakta unik dari user dlm bentuk JSON string array max 2 item. Balas [] jika tak ada. \nUser: ${messageText}\nAI: ${ans}`;
      const mRes = await generateText(mPrompt, 200);
      try { JSON.parse(stripCodeFence(mRes)).forEach(i => addMemory(getUserId(ctx), i)); } catch {}
    }

  } catch (err) {
    state.metrics.errors++;
    addLog(`Error handling message: ${err.message}`);
    await safeDeleteMessage(ctx, statusMsg.message_id);
    await ctx.reply(`❌ Error: ${err.message}`);
  } finally {
    await saveState();
  }
});

// ==========================================
// 8. WEB DASHBOARD UI (ADMIN CONTROL CENTER)
// ==========================================
http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const uptime = process.uptime();
    const ram = Math.round(process.memoryUsage().rss / 1024 / 1024);
    
    const logsHtml = state.systemLogs.map(l => `<div class="log-item">${l}</div>`).join('');
    
    res.end(`
      <html>
        <head>
          <title>Omni-AI Admin Control Center</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            :root { --bg: #0f172a; --panel: #1e293b; --text: #f8fafc; --accent: #38bdf8; --alert: #f43f5e; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
            .container { max-width: 900px; margin: auto; }
            h1 { color: var(--accent); border-bottom: 2px solid var(--panel); padding-bottom: 10px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
            .card { background: var(--panel); padding: 20px; border-radius: 12px; border-left: 4px solid var(--accent); }
            .card h3 { margin: 0 0 10px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; }
            .card .val { font-size: 24px; font-weight: bold; }
            .logs { background: #000; padding: 15px; border-radius: 8px; height: 300px; overflow-y: auto; font-family: monospace; font-size: 13px; color: #10b981; }
            .log-item { margin-bottom: 5px; border-bottom: 1px dashed #333; padding-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚙️ Omni-AI Control Center</h1>
            
            <div class="grid">
              <div class="card"><h3>AI Provider</h3><div class="val">${config.aiProvider.toUpperCase()}</div></div>
              <div class="card"><h3>Uptime</h3><div class="val">${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m</div></div>
              <div class="card"><h3>RAM Usage</h3><div class="val">${ram} MB</div></div>
              <div class="card"><h3>Total Users</h3><div class="val">${Object.keys(state.users).length}</div></div>
              <div class="card"><h3>Queries Processed</h3><div class="val">${state.metrics.messagesHandled}</div></div>
              <div class="card" style="border-color: var(--alert)"><h3>Spam Blocked</h3><div class="val">${state.metrics.spamBlocked}</div></div>
            </div>

            <h2>Terminal Logs</h2>
            <div class="logs">${logsHtml || 'No recent activity.'}</div>
          </div>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(config.port, () => console.log(`🌍 Control Center Active on Port ${config.port}`));

// ==========================================
// 9. UTILITIES
// ==========================================
async function generateText(prompt, maxTokens = 1000, useTools = false) {
  if (config.aiProvider === 'openai') {
    const opts = { model: config.openaiModel, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens };
    if (useTools) opts.tools = [{ type: 'web_search' }];
    const res = await openai.chat.completions.create(opts);
    return res.choices[0].message.content;
  }
  return ''; // Simplified fallback
}
function addMemory(userId, text) {
  const p = getUserProfile(userId);
  if (!p.memories.some(m => m.text === text)) { p.memories.push({text}); if(p.memories.length>50) p.memories.shift(); }
}
async function retrieveLocalKnowledge(q) { return ''; } // Simplified RAG placeholder
function touchUser(ctx) { const id = getUserId(ctx); state.users[id] ||= { memories: [] }; }
function getUserProfile(id) { return state.users[id]; }
function getChatState(id) { state.chats[id] ||= { recent: [] }; return state.chats[id]; }
function getUserId(ctx) { return String(ctx.from?.id); }
function getChatId(ctx) { return String(ctx.chat?.id); }
function isAdmin(ctx) { return config.adminIds.has(getUserId(ctx)); }
function extractMessageText(ctx) { return (ctx.message?.text || ctx.message?.caption || '').trim(); }
function getCommandPayload(ctx) { return extractMessageText(ctx).replace(/^\/\w+(?:@\w+)?\s*/i, ''); }
function allowRequest(ctx) {
  const uid = getUserId(ctx), now = Date.now(), bucket = (rateLimiter.get(uid)||[]).filter(t => now-t < config.rateLimitWindowMs);
  bucket.push(now); rateLimiter.set(uid, bucket); return bucket.length <= config.rateLimitMessages;
}
function rememberRecent(chat, role, text) { chat.recent.push({role, text: String(text).slice(0,500)}); if(chat.recent.length>10) chat.recent.shift(); }
async function replyLong(ctx, text) { const chunks = String(text).match(/[\s\S]{1,4000}/g)||[]; for(let c of chunks) await ctx.reply(c,{parse_mode:'Markdown'}).catch(()=>ctx.reply(c)); }
async function safeDeleteMessage(ctx, msgId) { if(msgId) try{ await ctx.deleteMessage(msgId); }catch{} }
function stripCodeFence(t) { return String(t).replace(/^`{3}\w*\n/i, '').replace(/`{3}$/i, '').trim(); }
function mustGetAnyEnv(keys) { const found = keys.find(k => process.env[k]); if(!found) process.exit(1); return process.env[found]; }

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

await initBot();
await bot.launch();
addLog('Bot instance started.');
