'use strict';

function reflect(topic = '') {
  const clean = String(topic || 'hari ini').trim();
  return [
    `Reflection: ${clean}`,
    '',
    'Apa yang terjadi?',
    '- Tuliskan fakta, bukan interpretasi dulu.',
    '',
    'Apa maknanya?',
    '- Pisahkan pelajaran, emosi, dan asumsi.',
    '',
    'Apa pola yang terlihat?',
    '- Cari error berulang, keputusan tertunda, atau hal yang sering menguras energi.',
    '',
    'Apa next action kecil?',
    '- Pilih satu tindakan yang bisa dilakukan dalam 15-30 menit.'
  ].join('\n');
}

module.exports = {
  reflect
};
