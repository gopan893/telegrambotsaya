'use strict';

function assumptions(text = '') {
  return [
    `Argumen/rencana: ${String(text || '').trim()}`,
    'Asumsi eksplisit: tujuan dan constraint sudah benar.',
    'Asumsi tersembunyi: data saat ini cukup untuk memilih solusi.',
    'Asumsi rapuh: effort implementasi dan risiko maintenance mungkin lebih besar dari perkiraan.',
    'Cara cek: cari evidence, uji kecil, dan bandingkan dengan alternatif.'
  ].join('\n');
}

function blindspots(text = '') {
  return [
    `Rencana/ide: ${String(text || '').trim()}`,
    '',
    'Blind spot potensial:',
    '- Mengoptimalkan fitur sebelum mengukur kebutuhan.',
    '- Meremehkan biaya maintenance.',
    '- Menganggap semua user butuh fitur kompleks.',
    '- Tidak punya rollback plan.',
    '- Tidak membedakan fakta, inferensi, dan opini.',
    '',
    'Pertanyaan cek: apa bukti terkuat bahwa rencana ini benar?'
  ].join('\n');
}

function perspectives(text = '') {
  return [
    `Masalah: ${String(text || '').trim()}`,
    '',
    'Perspektif user: apakah ini menyelesaikan kebutuhan nyata?',
    'Perspektif engineer: apakah mudah dirawat dan dites?',
    'Perspektif operasi: apakah stabil dan murah di Render?',
    'Perspektif safety: apakah ada aksi berisiko atau data sensitif?',
    'Perspektif belajar: apa pelajaran terpenting dari proses ini?'
  ].join('\n');
}

module.exports = {
  assumptions,
  blindspots,
  perspectives
};
