'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

function getJsonPath(baseDir, key) {
  return path.join(baseDir, `${key}.json`);
}

async function readJsonFile(baseDir, key, defaultValue) {
  const filePath = getJsonPath(baseDir, key);

  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (_) {
    return defaultValue;
  }
}

async function writeJsonFileAtomic(baseDir, key, data) {
  const filePath = getJsonPath(baseDir, key);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const str = JSON.stringify(data, null, 2);

  await fsp.writeFile(tmpPath, str, 'utf-8');
  await fsp.rename(tmpPath, filePath);
}

module.exports = {
  readJsonFile,
  writeJsonFileAtomic
};
