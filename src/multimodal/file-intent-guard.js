'use strict';

const FILE_INTENT_PATTERN = /\b(file|berkas|gambar|foto|image|dokumen|document|pdf|attachment|lampiran|analisis\s+file|analisis\s+gambar|lihat\s+gambar|isi\s+file|preview|photo|video|audio|ocr|visual|file\s+tadi|gambar\s+tadi|foto\s+tadi|dokumen\s+tadi|attachment\s+tadi)\b/i;

function hasAttachment(updateOrMessage = {}) {
  const msg = updateOrMessage.message || updateOrMessage;
  return Boolean(msg?.photo || msg?.document || msg?.voice || msg?.video || msg?.audio);
}

function isFileRelatedMessage(message = '', context = {}) {
  const text = String(message || context.text || '').trim();
  if (hasAttachment(context.update || context.msg || context.message || {})) return true;
  if (context.hasAttachment === true || context.fileRelated === true) return true;
  if (!text) return false;
  return FILE_INTENT_PATTERN.test(text);
}

function shouldUseRecentFileContext(message = '', context = {}) {
  if (hasAttachment(context.update || context.msg || context.message || {})) return true;
  return isFileRelatedMessage(message, context);
}

module.exports = {
  FILE_INTENT_PATTERN,
  hasAttachment,
  isFileRelatedMessage,
  shouldUseRecentFileContext
};
