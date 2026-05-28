'use strict';

function synthesizeNote(text = '') {
  return [
    `Catatan: ${String(text || '').trim()}`,
    'Ide inti: ambil satu prinsip yang bisa dipakai ulang.',
    'Koneksi: hubungkan dengan goal, workflow, atau keputusan aktif.',
    'Next: ubah catatan menjadi satu tindakan kecil.'
  ].join('\n');
}

module.exports = {
  synthesizeNote
};
