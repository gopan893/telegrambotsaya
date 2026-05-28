'use strict';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescapeHtml(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeMarkdown(text) {
  let output = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .trim();

  output = output
    .split('\n')
    .filter(line => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map(line => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const title = heading[1].replace(/^\*\*(.+)\*\*$/, '$1').trim();
        return `**${title}**`;
      }

      return line
        .replace(/^(\s*)[-*]\s+/g, '$1• ')
        .replace(/^(\s*)[•]\s{2,}/g, '$1• ');
    })
    .join('\n');

  output = output
    .replace(/[ \u00a0]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');

  return output.trim();
}

function markdownToTelegramHtml(text) {
  const codeBlocks = [];
  let output = normalizeMarkdown(text);

  output = output.replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `__TG_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre>${escapeHtml(String(code || '').trim())}</pre>`);
    return token;
  });

  const inlineCodes = [];
  output = output.replace(/`([^`\n]+?)`/g, (_, code) => {
    const token = `__TG_INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  output = escapeHtml(output);

  output = output
    .replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+?)__/g, '<b>$1</b>')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*(.+?)(?=\n|$)/g, '$1<b>$2</b>')
    .replace(/(^|\n)\s*[-*]\s+/g, '$1• ');

  inlineCodes.forEach((html, index) => {
    output = output.replace(`__TG_INLINE_CODE_${index}__`, html);
  });

  codeBlocks.forEach((html, index) => {
    output = output.replace(`__TG_CODE_BLOCK_${index}__`, html);
  });

  return output;
}

function improveReadability(text) {
  let output = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \u00a0]+$/gm, '')
    .replace(/([^\n])\n(• )/g, '$1\n\n$2')
    .replace(/(<\/b>)\n(• )/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  output = output
    .split('\n')
    .map(line => line.replace(/^(\s*)[-*]\s+/g, '$1• '))
    .join('\n');

  return output.trim();
}

function stripTelegramHtml(text) {
  return unescapeHtml(
    String(text || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|pre)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).replace(/\n{3,}/g, '\n\n').trim();
}

function formatTelegramMessage(text) {
  const normalized = normalizeMarkdown(text);
  if (!normalized) return '';
  return improveReadability(markdownToTelegramHtml(normalized));
}

module.exports = {
  escapeHtml,
  formatTelegramMessage,
  improveReadability,
  markdownToTelegramHtml,
  normalizeMarkdown,
  stripTelegramHtml
};
