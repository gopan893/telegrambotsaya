# Phase 7 End-to-End Audit

Status repo saat audit:

- Branch aktif: `main`
- Last known commit sebelum Phase 7: `7e7b794 storage: add postgres relational schema`
- Merge readiness: aman karena branch `main` sinkron dengan `origin/main` sebelum Phase 7 dimulai.
- Deployment risk utama: env wajib Render harus lengkap, AI provider minimal satu aktif, dan webhook URL harus benar.

## Command Audit

| Command | Tujuan | Contoh input | Expected behavior | Status | Risiko |
| --- | --- | --- | --- | --- | --- |
| `/start` | Sapaan awal | `/start` | Balas greeting dan hint `/help` | Ready | rendah |
| `/help` | Bantuan command | `/help` | Daftar command lama+baru | Ready | output panjang harus chunked |
| `/ping` | Cek hidup | `/ping` | Balas pong/latency | Ready | rendah |
| `/reset` | Reset user state | `/reset` | Guard/konfirmasi aman | Ready | jangan reset data tanpa niat user |
| `/stats` | Runtime ringkas | `/stats` | Storage, Redis, memory, plugin | Ready | jangan expose secret |
| `/mode` | Manual mode | `/mode` | Manual override tetap ada | Ready | jangan bentrok adaptive |
| `/adaptive status` | Status adaptive | `/adaptive status` | Status on/off/profile | Ready | rendah |
| `/adaptive on` | Aktifkan adaptive | `/adaptive on` | Adaptive aktif | Ready | rendah |
| `/adaptive off` | Matikan adaptive | `/adaptive off` | Adaptive nonaktif | Ready | rendah |
| `/adaptive reset` | Reset adaptive | `/adaptive reset` | Profile adaptive reset | Ready | rendah |
| `/hitung` | Kalkulator command | `/hitung 25*4` | Hasil kalkulasi | Ready | unit waktu natural jangan masuk kalkulator |
| `/jam` | Waktu | `/jam Jakarta` | Waktu saat ini | Ready | rendah |
| `/tanggal` | Tanggal | `/tanggal` | Tanggal saat ini | Ready | rendah |
| `/cuaca` | Weather | `/cuaca Bandung` | Weather atau API key missing | Ready | optional env |
| `/cari` | Search | `/cari Node.js` | Ringkasan search atau fallback | Ready | optional env |
| `/remember` | Simpan memory | `/remember Saya membangun AI bot` | Memory tersimpan | Ready | storage fallback |
| `/memory` | Lihat memory | `/memory` | 10 memory terbaru | Ready | top-k saja |
| `/goals` | List goal | `/goals` | Goal aktif | Ready | top-k saja |
| `/goaladd` | Tambah goal | `/goaladd X | Y | high` | Goal tersimpan | Ready | format salah beri contoh |
| `/goalupdate` | Update goal | `/goalupdate id | progress | 50` | Goal update | Ready | field dibatasi |
| `/workflows` | List workflow | `/workflows` | Workflow aktif | Ready | top-k saja |
| `/workflowadd` | Tambah workflow | `/workflowadd Deploy | Audit Render` | Workflow tersimpan | Ready | format salah beri contoh |
| `/workflowstep` | Tambah step | `/workflowstep id | Test command` | Step tersimpan | Ready | workflow missing aman |
| `/workflowdone` | Complete step | `/workflowdone id | 1` | Step selesai | Ready | step missing aman |
| `/insights` | List insight | `/insights` | Insight terbaru | Ready | top-k saja |
| `/aios` | Status AI OS | `/aios` | Memory/goals/workflows/insights/storage | Ready | output ringkas |

## Collaboration Command Audit

| Command | Expected behavior | Status |
| --- | --- | --- |
| `/think <masalah>` | Pecah masalah dan next action | Ready |
| `/strategy <tujuan>` | Opsi, risiko, trade-off | Ready |
| `/reflect <topik>` | Refleksi tanpa diagnosis | Ready |
| `/learnplan <topik>` | Roadmap belajar | Ready |
| `/mentalmodel <konsep>` | Mental model yang cocok | Ready |
| `/decision <pilihan>` | Decision support, bukan keputusan final | Ready |
| `/blindspot <rencana>` | Risiko tersembunyi | Ready |
| `/assumptions <argumen>` | Fakta/asumsi/opini | Ready |
| `/perspectives <masalah>` | Multi-perspective analysis | Ready |
| `/insight <catatan>` | Insight ringan | Ready |
| `/journal [isi]` | Prompt/refleksi harian | Ready |
| `/collab` | Status collaboration | Ready |
| `/collab-reset` | Reset collaboration-only state | Ready |

## Ops/Admin Audit

| Command | Expected behavior | Status |
| --- | --- | --- |
| `/ops` | Ringkasan ops admin-only | Ready |
| `/health` | Health + storage/migration status | Ready |
| `/diag` | Diagnostics | Ready |
| `/reliability` | Reliability score | Ready |
| `/perf` | Performance summary | Ready |
| `/tokens` | Token estimate | Ready |

## Manual Telegram Checklist

Core:

- `/ping`
- `/help`
- `/stats`

AI OS:

- `/remember Saya sedang membangun Telegram AI Bot production`
- `/memory`
- `/goaladd Bangun AI bot production | Membuat bot stabil dan adaptive | high`
- `/goals`
- `/workflowadd Stabilkan Render deploy | Audit command dan natural AI OS`
- `/workflows`
- `/workflowstep <workflowId> | Test semua command di Telegram`
- `/workflowdone <workflowId> | 1`
- `/insights`

Natural chat:

- `Apa langkah berikutnya untuk project bot saya?`
- `Saya bingung prioritas minggu ini apa`
- `Lanjutkan workflow terakhir`
- `Apa risiko terbesar dari roadmap AI saya?`
- `Apa insight penting dari project ini?`
- `Cek apakah bot saya sehat`
- `Halo`
- `25*4`
- `750jam berapa hari?`
- `Saya merasa pusing`
- `Kenapa?`

Expected:

- command lama tetap jalan;
- command baru tidak crash saat argumen kosong;
- output panjang ter-chunk;
- admin-only tetap aman;
- natural AI OS hanya aktif pada trigger relevan;
- fallback JSON/Redis memory tetap berjalan.
