'use strict';

const fs = require('fs');
const path = require('path');

function sanitizeConsolidationData(data) {
  if (!data || typeof data !== 'object') return data;
  const redacted = JSON.parse(JSON.stringify(data));
  const secretKeys = ['TELEGRAM_TOKEN', 'DATABASE_URL', 'REDIS_URL', 'DASHBOARD_ADMIN_TOKEN', 'GITHUB_TOKEN', 'GOOGLE_CLIENT_SECRET', 'CLOUDFLARE_API_TOKEN', 'token', 'secret', 'password', 'apiKey', 'api_key', 'privateKey'];

  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }
    for (const key of Object.keys(obj)) {
      if (secretKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        obj[key] = '[REDACTED_SECRET]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        walk(obj[key]);
      }
    }
  }

  walk(redacted);
  return redacted;
}

function getSrcDirectories(basePath) {
  const srcPath = path.join(basePath, 'src');
  try {
    return fs.readdirSync(srcPath).filter(f => {
      try {
        return fs.statSync(path.join(srcPath, f)).isDirectory();
      } catch (_) {
        return false;
      }
    });
  } catch (_) {
    return [];
  }
}

function getFilesInDirectory(dir) {
  try {
    return fs.readdirSync(dir).filter(f => {
      try {
        return fs.statSync(path.join(dir, f)).isFile();
      } catch (_) {
        return false;
      }
    });
  } catch (_) {
    return [];
  }
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (_) {
    return 0;
  }
}

module.exports = {
  sanitizeConsolidationData,
  getSrcDirectories,
  getFilesInDirectory,
  countLines
};
