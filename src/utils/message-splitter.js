'use strict';

function trimChunk(text) {
  return String(text || '').trim();
}

function avoidOpenHtmlTag(text, cut) {
  const left = text.slice(0, cut);
  const lastOpen = left.lastIndexOf('<');
  const lastClose = left.lastIndexOf('>');

  if (lastOpen > lastClose && cut - lastOpen < 120) {
    return Math.max(1, lastOpen);
  }

  return cut;
}

function findCutPoint(text, maxLength) {
  const minUsefulCut = Math.min(900, Math.floor(maxLength * 0.45));
  const delimiters = ['\n\n', '\n', '. ', ' '];

  for (const delimiter of delimiters) {
    const index = text.lastIndexOf(delimiter, maxLength);
    if (index >= minUsefulCut) {
      return avoidOpenHtmlTag(text, index + delimiter.length);
    }
  }

  return avoidOpenHtmlTag(text, maxLength);
}

function splitMessage(text, maxLength = 3900) {
  const source = trimChunk(text);
  const limit = Math.max(500, Number(maxLength) || 3900);

  if (!source) return [];
  if (source.length <= limit) return [source];

  const chunks = [];
  let remaining = source;

  while (remaining.length > limit) {
    let cut = findCutPoint(remaining, limit);

    if (cut <= 0 || cut >= remaining.length) {
      cut = limit;
    }

    const chunk = trimChunk(remaining.slice(0, cut));
    if (chunk) chunks.push(chunk);
    remaining = trimChunk(remaining.slice(cut));
  }

  if (remaining) chunks.push(remaining);

  return chunks;
}

module.exports = {
  splitMessage
};
