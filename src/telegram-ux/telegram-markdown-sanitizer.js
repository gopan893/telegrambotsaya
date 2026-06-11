'use strict';

const BLOCKED_PATTERNS = [
  /TELEGRAM_TOKEN\s*=/i,
  /GITHUB_TOKEN\s*=/i,
  /DATABASE_URL\s*=/i,
  /REDIS_URL\s*=/i,
  /DASHBOARD_ADMIN_TOKEN\s*=/i,
  /GOOGLE_CLIENT_SECRET\s*=/i,
  /CLOUDFLARE_API_TOKEN\s*=/i,
  /RENDER_DEPLOY_HOOK\s*=/i,
  /sk-[A-Za-z0-9]{10,}/g,
  /ghp_[A-Za-z0-9]{10,}/g,
  /github_pat_[A-Za-z0-9_]{10,}/g,
  /postgresql:\/\/[^\s]+/g,
  /rediss:\/\/[^\s]+/g,
  /Bearer\s+[A-Za-z0-9._-]{10,}/gi,
  /api[_-]?key['"]?\s*[:=]\s*['"]?[A-Za-z0-9_]{10,}/gi
];

const TELEGRAM_MD_ESCAPE_MAP = {
  '_': '\\_',
  '*': '\\*',
  '[': '\\[',
  ']': '\\]',
  '(': '\\(',
  ')': '\\)',
  '~': '\\~',
  '`': '\\`',
  '>': '\\>',
  '&': '\\&',
  '#': '\\#',
  '+': '\\+',
  '-': '\\-',
  '=': '\\=',
  '|': '\\|',
  '{': '\\{',
  '}': '\\}',
  '.': '\\.',
  '!': '\\!'
};

const MARKDOWNV2_RESERVED = new Set(Object.keys(TELEGRAM_MD_ESCAPE_MAP));

function escapeTelegramMarkdown(text) {
  if (!text) return '';
  let result = String(text);
  for (const [char, escaped] of Object.entries(TELEGRAM_MD_ESCAPE_MAP)) {
    result = result.split(char).join(escaped);
  }
  return result;
}

function sanitizeTelegramMarkdown(text) {
  if (!text) return '';
  let result = String(text);
  result = redactSecrets(result);
  result = result.replace(/\r\n?/g, '\n');
  result = protectCodeBlocks(result, (code) => {
    const safe = code.replace(/[\\`*_~\[\]()#+\-!.>|{}]/g, '');
    return safe;
  });
  result = result.replace(/_{2}([^_]+?)_{2}/g, '<u>$1</u>');
  result = result.replace(/\*{2}([^*]+?)\*{2}/g, '<b>$1</b>');
  result = result.replace(/(^|\n)\s{0,3}#{1,6}\s+(.+?)(?=\n|$)/g, '$1<b>$2</b>');
  result = result.replace(/(^|\n)\s*[-*]\s+/g, '$1• ');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function sanitizeTelegramHtml(text) {
  if (!text) return '';
  let result = String(text);
  result = redactSecrets(result);
  result = result.replace(/\r\n?/g, '\n');
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre'];
  result = result.replace(/<\/?([A-Za-z0-9]+)(?:\s[^>]*)?>/g, (match, tag) => {
    if (allowedTags.includes(tag.toLowerCase())) return match;
    return '';
  });
  result = result.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (match, url, text) => {
    const safeUrl = redactSecrets(url);
    if (safeUrl !== url) return text || '';
    return match;
  });
  result = result.replace(/<pre>([\s\S]*?)<\/pre>/g, (match, code) => {
    return '<pre>' + redactSecrets(code) + '</pre>';
  });
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function stripUnsafeTelegramFormatting(text) {
  if (!text) return '';
  let result = String(text);
  result = redactSecrets(result);
  result = result.replace(/<[^>]+>/g, '');
  result = result.replace(/[\\`*_~\[\]()#+\-!.>|{}]/g, '');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

function detectFormattingRisk(text) {
  if (!text) return { risky: false, reasons: [] };
  const reasons = [];
  const result = String(text);
  const codeFences = (result.match(/```/g) || []).length;
  if (codeFences % 2 !== 0) reasons.push('unclosed_code_fence');
  const openBold = (result.match(/\*\*/g) || []).length;
  if (openBold % 2 !== 0) reasons.push('unbalanced_bold');
  const openItalic = (result.match(/_{2}/g) || []).length;
  if (openItalic % 2 !== 0) reasons.push('unbalanced_underline');
  if (result.length > 4000) reasons.push('exceeds_telegram_limit');
  const htmlTagCount = (result.match(/<\/?[A-Za-z]/g) || []).length;
  if (htmlTagCount > 50) reasons.push('too_many_html_tags');
  if (result.includes('[') && result.includes(']') && result.includes('(') && result.includes(')')) {
    const linkMatches = result.match(/\[([^\]]*)\]\(([^)]*)\)/g);
    if (linkMatches && linkMatches.some(m => m.length > 200)) reasons.push('suspicious_long_link');
  }
  return { risky: reasons.length > 0, reasons };
}

function protectCodeBlocks(text, transformFn) {
  if (!text) return '';
  const blocks = [];
  let result = String(text).replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const token = `__CODE_BLOCK_${blocks.length}__`;
    blocks.push('```' + (lang || '') + '\n' + (transformFn ? transformFn(code) : code) + '\n```');
    return token;
  });
  blocks.forEach((block, i) => {
    result = result.replace(`__CODE_BLOCK_${i}__`, block);
  });
  return result;
}

function redactSecrets(text) {
  if (!text) return '';
  let result = String(text);
  for (const pattern of BLOCKED_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

module.exports = {
  BLOCKED_PATTERNS,
  TELEGRAM_MD_ESCAPE_MAP,
  detectFormattingRisk,
  escapeTelegramMarkdown,
  protectCodeBlocks,
  redactSecrets,
  sanitizeTelegramHtml,
  sanitizeTelegramMarkdown,
  stripUnsafeTelegramFormatting
};
