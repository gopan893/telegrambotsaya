'use strict';

/**
 * Voice Service — TTS (node-edge-tts) + Transcription (9router/OpenAI)
 * Zero server, zero API key for TTS. Transcribe via GACOR_API_KEY.
 */

const { EdgeTTS } = require('node-edge-tts');
const axios = require('axios');
const FormData = require('form-data');
const { randomBytes } = require('crypto');
const { writeFileSync, readFileSync, unlinkSync } = require('fs');
const { join } = require('path');
const os = require('os');

// ── TTS ──────────────────────────────────────────────────────

/**
 * Generate suara dari teks, return Buffer
 * @param {string} text Teks ke suara
 * @param {object} [opts] Opsi: voice, rate, pitch
 * @returns {Promise<Buffer>}
 */
async function textToSpeechBuffer(text, opts = {}) {
  const voice = opts.voice || 'id-ID-ArdiNeural';
  const lang = opts.lang || 'id-ID';
  const rate = opts.rate || 'default';
  const pitch = opts.pitch || 'default';

  const tts = new EdgeTTS({ voice, lang, outputFormat: 'audio-24khz-96kbitrate-mono-mp3', rate, pitch });
  const tmpFile = join(os.tmpdir(), `tts_${randomBytes(6).toString('hex')}.mp3`);

  try {
    await tts.ttsPromise(text, tmpFile);
    const buffer = readFileSync(tmpFile);
    return buffer;
  } finally {
    try { unlinkSync(tmpFile); } catch (_) {}
  }
}

// ── Transcription ────────────────────────────────────────────

/**
 * Transkrip audio via 9router /v1/audio/transcriptions (OpenAI-compatible)
 * @param {Buffer} audioBuffer Raw audio data
 * @param {object} attachment { fileName, mimeType }
 * @param {string} apiKey GACOR_API_KEY
 * @param {string} baseUrl GACOR_BASE_URL
 * @returns {Promise<string>}
 */
async function transcribeAudio(audioBuffer, attachment, apiKey, baseUrl) {
  if (!apiKey) throw new Error('GACOR_API_KEY tidak diset');

  const ext = (attachment.fileName || '.oga').split('.').pop();
  const url = `${(baseUrl || 'https://api.9router.com/v1').replace(/\/+$/, '')}/audio/transcriptions`;

  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: `audio.${ext}`,
    contentType: attachment.mimeType || 'audio/ogg'
  });
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const res = await axios.post(url, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${apiKey}`
    },
    timeout: 30000
  });

  return String(res.data || '').trim();
}

// ── Telegram Voice Sender ────────────────────────────────────

/**
 * Kirim voice note ke Telegram via FormData
 * @param {number|string} chatId
 * @param {Buffer} audioBuffer
 * @param {object} [extra] { reply_to_message_id, caption }
 * @param {string} telegramApi Base URL bot API
 */
async function sendVoiceBuffer(chatId, audioBuffer, extra = {}, telegramApi) {
  if (!telegramApi) throw new Error('TELEGRAM_API tidak tersedia');

  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (extra.reply_to_message_id) {
    form.append('reply_to_message_id', String(extra.reply_to_message_id));
  }
  if (extra.caption) {
    form.append('caption', extra.caption);
  }
  form.append('voice', audioBuffer, {
    filename: 'voice.mp3',
    contentType: 'audio/mpeg'
  });

  try {
    await axios.post(`${telegramApi}/sendVoice`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    return true;
  } catch (e) {
    console.error('[voice] sendVoice error:', e.response?.data || e.message);
    return false;
  }
}

module.exports = {
  textToSpeechBuffer,
  transcribeAudio,
  sendVoiceBuffer
};
