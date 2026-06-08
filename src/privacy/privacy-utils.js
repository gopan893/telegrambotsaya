'use strict';

const crypto = require('crypto');

function generateId() {
  return crypto.createHash('sha1').update(`pry:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

module.exports = { generateId };
