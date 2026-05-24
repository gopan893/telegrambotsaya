'use strict';

function buildLearningGuide() {
  return [
    '📚 Mode Belajar Arsitektur Bot',
    '',
    'Kenapa perubahan ini dilakukan:',
    '- File besar sulit dirawat, jadi bagian inti dipisah menjadi module kecil.',
    '- Retry, queue, cache, dan error guard dibuat terpusat agar bug tidak tersebar.',
    '- Provider AI dirouting secara sadar supaya bot tidak membuang request ke API yang tidak aktif.',
    '',
    'Trade-off penting:',
    '- Modularisasi membuat jumlah file bertambah, tetapi debugging dan pengembangan jadi lebih mudah.',
    '- Cache mempercepat jawaban berulang, tetapi jawaban yang sangat baru sebaiknya tetap lewat search.',
    '- Retry meningkatkan stabilitas, tetapi jumlah retry harus dibatasi agar RAM dan waktu proses tetap hemat.',
    '',
    'Risiko jika tidak diperbaiki:',
    '- Global state bisa tumbuh tanpa batas.',
    '- Error async dapat membuat proses berhenti.',
    '- JSON storage bisa rusak jika proses mati saat sedang menulis file.',
    '- Provider AI yang sedang error bisa terus dipanggil dan memperlambat bot.',
    '',
    'Alternatif solusi:',
    '- Pakai worker queue eksternal seperti BullMQ, tetapi itu lebih berat untuk Render free tier.',
    '- Pecah semua command sekaligus, tetapi risikonya besar untuk fitur lama.',
    '- Pakai database penuh, tetapi Redis + JSON fallback lebih ringan untuk tahap ini.',
    '',
    'Best practice singkat:',
    '- Pisahkan code berdasarkan tanggung jawab, bukan berdasarkan ukuran saja.',
    '- Batasi cache, memory, dan queue dengan TTL atau batas jumlah data.',
    '- Semua API eksternal perlu timeout, retry terbatas, dan logging yang jelas.',
    '',
    'Apa yang perlu kamu pahami:',
    '- Request Telegram masuk lewat webhook.',
    '- Command diproses handler, lalu state disimpan ke Redis atau JSON.',
    '- AI router memilih provider, cache mencegah panggilan ulang, circuit breaker menahan provider yang gagal.',
    '- Scheduler dan cleanup berjalan ringan agar aman saat Render restart.',
    '',
    'Langkah berpikir ringkas:',
    '1. Cari bagian yang paling sering menyebabkan crash.',
    '2. Pisahkan fungsi pendukung yang aman tanpa mengubah command lama.',
    '3. Tambahkan batas RAM dan retry kecil.',
    '4. Validasi sintaks sebelum deploy.',
    '5. Commit perubahan per bagian agar mudah dilacak.'
  ].join('\n');
}

module.exports = {
  buildLearningGuide
};
