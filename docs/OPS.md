# AI Operations & Reliability System (Phase 10)

Sistem AI Operations (Ops) dan Keandalan menyediakan fondasi monitoring produksi, benchmark evaluasi mandiri, deteksi regresi otomatis, mitigasi insiden, dan optimasi biaya/sumber daya tanpa ketergantungan eksternal yang berat.

## Arsitektur & Modul

Sistem Ops berpusat pada `src/ops/index.js` yang mengekspos modul-modul berikut:

1. **Ops Store (`ops-store.js`)**: Persistence state ops (telemetry, incident history, benchmark runs) menggunakan driver JSON/PostgreSQL secara atomic.
2. **Health Monitor (`health-monitor.js`)**: Memantau ketersediaan RAM, uptime, ketersediaan provider AI (Mistral/Groq), dan mengklasifikasikan status kesehatan (`healthy`, `degraded`, `critical`).
3. **Telemetry Collector (`telemetry-collector.js`)**: Mengumpulkan metrik request, command, latensi API, call AI, success/fail rate, dan menghitung anomaly score.
4. **Diagnostics Engine (`diagnostics-engine.js`)**: Mendiagnosis penyebab degradasi sistem (misal: spike error, overhead memory, provider outage).
5. **Benchmark Engine (`benchmark-engine.js`)**: Menjalankan evaluasi suite lokal (12 jenis skenario) untuk memverifikasi fungsionalitas kognitif tanpa memanggil API LLM berbayar.
6. **Reliability Scorer (`reliability-scorer.js`)**: Menghitung skor keandalan keseluruhan skala 0-100 berdasarkan kesehatan dan kinerja telemetry.
7. **Regression Detector (`regression-detector.js`)**: Mendeteksi penurunan kinerja/skor dibanding baseline terbaru.
8. **Incident Handler (`incident-handler.js`)**: Otomatis mendeteksi, mencatat, dan mengeskalasikan insiden operasional.
9. **Recovery Controller (`recovery-controller.js`)**: Menyediakan rekomendasi aksi pemulihan aman (mitigasi/fallback) secara mandiri.
10. **Cost & Resource Optimizer (`cost-optimizer.js`)**: Menganalisis efisiensi penggunaan token dan efisiensi memori runtime/graph.

---

## Panduan Perintah Admin Telegram

Semua perintah di bawah ini hanya dapat diakses oleh Admin terdaftar (melalui `ADMIN_SET`):

*   `/ops` — Menampilkan ringkasan dasbor operasional terpadu (kesehatan, memori, skor reliabilitas, status benchmark, insiden terbaru, dan rekomendasi tuning).
*   `/health` — Menampilkan detail status kesehatan RAM, ketersediaan provider AI, dan deteksi insiden aktif.
*   `/diag` — Menjalankan mesin diagnostik mandiri untuk mendeteksi akar masalah performa/degradasi.
*   `/benchmark` — Menjalankan suite benchmark cepat lokal untuk memverifikasi fungsionalitas kognitif.
*   `/benchmarkfull` — Menjalankan benchmark suite lengkap secara mendalam.
*   `/benchmarks` — Menampilkan riwayat hasil benchmark suite sebelumnya.
*   `/perf` — Menampilkan profil latensi (p50/p90/p95), operasi lambat (slow operations bottleneck), dan profil memori.
*   `/cost` — Menganalisis efisiensi token, cost estimation, memori graph, graph size, active workflows, dan memberikan saran optimasi.
*   `/tokens` — Menganalisis statistik token prompt dan completion, provider termahal, dan deteksi token spike.
*   `/reliability` — Menampilkan skor reliabilitas (0-100), tren stabilitas, analisis area terkuat/terlemah, dan faktor risiko.
*   `/regression` — Mengecek apakah terjadi regresi performa atau peningkatan error secara signifikan.
*   `/recover` — Menampilkan rekomendasi aksi pemulihan dan memicu eksekusi mitigasi aman (seperti *switch to fallback*, *prune volatile telemetry*, *clear ops caches*).
*   `/rollbackplan` — Menyusun checklist rollback aman jika terjadi regresi pasca deploy.
*   `/opslessons` — Membuka pangkalan pengetahuan ops, mencatat pelajaran operasional baru, dan menampilkan checklist deployment.
*   `/opskb` — Mencari instruksi penanganan insiden (*fix recipe*) spesifik dari pangkalan pengetahuan ops.
*   `/canary` — Mengelola draft canary deployment, merekam metrik canary, membandingkan kualitas canary vs baseline, dan melakukan promosi/rollback manual.
*   `/opsreset` — Mereset state/telemetry ops menjadi bersih kembali tanpa memengaruhi data kognitif user.
