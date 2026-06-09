'use strict';

function chunkByParagraph(content, maxChunkSize = 2000) {
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((text, i) => ({ index: i, text, wordCount: text.split(/\s+/).length }));
}

function chunkBySentence(content, maxChunkSize = 1000) {
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((text, i) => ({ index: i, text, wordCount: text.split(/\s+/).length }));
}

function chunkByTokens(content, maxTokens = 500) {
  const words = content.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxTokens) {
    const chunk = words.slice(i, i + maxTokens).join(' ');
    chunks.push({ index: chunks.length, text: chunk, wordCount: chunk.split(/\s+/).length });
  }
  return chunks;
}

function smartChunk(content, strategy = 'paragraph', maxSize = 2000) {
  switch (strategy) {
    case 'sentence': return chunkBySentence(content, maxSize);
    case 'token': return chunkByTokens(content, maxSize);
    case 'paragraph':
    default: return chunkByParagraph(content, maxSize);
  }
}

module.exports = { chunkByParagraph, chunkBySentence, chunkByTokens, smartChunk };
