'use strict';

function verifySignature(pluginId, signature, publicKey) {
  if (!signature || !publicKey) return { valid: false, reason: 'Missing signature or key' };
  return { valid: true, algorithm: 'sha256', pluginId };
}

function generateChecksum(content) {
  let hash = 0;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `mock_checksum_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function verifyChecksum(content, expectedChecksum) {
  return generateChecksum(content) === expectedChecksum;
}

module.exports = { verifySignature, generateChecksum, verifyChecksum };
