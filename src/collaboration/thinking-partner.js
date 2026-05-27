'use strict';

const strategic = require('./strategic-thinking-engine');

function think(text = '') {
  const analysis = strategic.analyze(text);
  return [
    'Thinking Partner',
    '',
    strategic.format(analysis),
    '',
    'Pertanyaan untuk kamu:',
    '- Bagian mana yang paling tidak pasti?',
    '- Apa langkah kecil yang bisa memberi data baru?'
  ].join('\n');
}

module.exports = {
  think
};
