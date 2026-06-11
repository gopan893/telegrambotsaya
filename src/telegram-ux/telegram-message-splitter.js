'use strict';

const DEFAULT_MAX_LENGTH = 3500;
const ABSOLUTE_MAX_LENGTH = 4096;

function splitTelegramMessage(text, options) {
  if (!text) return [];
  const maxLength = (options && options.maxLength) || DEFAULT_MAX_LENGTH;
  const safeMax = Math.min(maxLength, ABSOLUTE_MAX_LENGTH);
  const result = String(text).trim();
  if (!result) return [];
  if (result.length <= safeMax) return [result];
  const parts = splitByParagraph(result, safeMax);
  return addPartHeaders(parts);
}

function splitByParagraph(text, maxLength) {
  const paragraphs = text.split(/\n\n+/);
  const parts = [];
  let current = '';
  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= maxLength) {
      current = current ? current + '\n\n' + para : para;
    } else if (para.length > maxLength) {
      if (current) {
        parts.push(current);
        current = '';
      }
      const subParts = splitCodeBlockSafely(para, maxLength);
      for (const sp of subParts) {
        const trimmed = sp.trim();
        if (trimmed) parts.push(trimmed);
      }
    } else {
      if (current) parts.push(current);
      current = para;
    }
  }
  if (current) parts.push(current);
  return parts.filter(Boolean);
}

function splitCodeBlockSafely(text, maxLength) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      const beforeParts = splitPlainText(before, maxLength);
      parts.push(...beforeParts);
    }
    const lang = match[1];
    const code = match[2];
    const fullBlock = '```' + lang + '\n' + code + '\n```';
    if (fullBlock.length <= maxLength) {
      parts.push(fullBlock);
    } else {
      const codeLines = code.split('\n');
      let currentBlock = '';
      for (const line of codeLines) {
        const testBlock = currentBlock ? currentBlock + '\n' + line : line;
        if (('```' + lang + '\n' + testBlock + '\n```').length <= maxLength) {
          currentBlock = testBlock;
        } else {
          if (currentBlock) {
            parts.push('```' + lang + '\n' + currentBlock + '\n```');
            parts.push('```\n... [code block continued] ...\n```');
          }
          currentBlock = line;
        }
      }
      if (currentBlock) {
        parts.push('```' + lang + '\n' + currentBlock + '\n```');
      }
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const after = text.slice(lastIndex);
    const afterParts = splitPlainText(after, maxLength);
    parts.push(...afterParts);
  }
  return parts.filter(Boolean);
}

function splitPlainText(text, maxLength) {
  if (!text) return [];
  const parts = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let cut = maxLength;
    const paragraphBoundary = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraphBoundary > maxLength * 0.5) {
      cut = paragraphBoundary;
    } else {
      const sentenceBoundary = remaining.lastIndexOf('. ', maxLength);
      if (sentenceBoundary > maxLength * 0.4) {
        cut = sentenceBoundary + 1;
      } else {
        const spaceBoundary = remaining.lastIndexOf(' ', maxLength);
        if (spaceBoundary > maxLength * 0.3) {
          cut = spaceBoundary;
        }
      }
    }
    const chunk = remaining.slice(0, cut).trim();
    if (chunk) parts.push(chunk);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function addPartHeaders(parts) {
  if (!parts || parts.length <= 1) return parts || [];
  return parts.map((part, index) => {
    const header = 'Bagian ' + (index + 1) + '/' + parts.length;
    return header + '\n\n' + part;
  });
}

function validateTelegramMessageLength(parts) {
  if (!parts || !Array.isArray(parts)) return { ok: false, errors: ['no_parts'] };
  const errors = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > ABSOLUTE_MAX_LENGTH) {
      errors.push('part_' + (i + 1) + '_exceeds_' + ABSOLUTE_MAX_LENGTH);
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  ABSOLUTE_MAX_LENGTH,
  DEFAULT_MAX_LENGTH,
  addPartHeaders,
  splitByParagraph,
  splitCodeBlockSafely,
  splitTelegramMessage,
  validateTelegramMessageLength
};
