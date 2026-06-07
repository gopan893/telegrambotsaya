# Advanced Research Agent

Phase 43 menambahkan layer riset evidence-grounded untuk Telegram AI OS.

## Tujuan

- Membuat research task dari chat, dashboard, atau agent lain.
- Mengutamakan project docs dan Knowledge Graph sebelum external search.
- Menilai credibility, relevance, dan freshness source.
- Memisahkan fakta, asumsi, unknown/gap, dan rekomendasi.
- Menolak penyimpanan input yang mirip secret.

## Flow

1. User mengajukan pertanyaan riset.
2. Research Task Planner membuat scope, subquestion, dan source requirements.
3. Source Collector mengumpulkan source read-only dari docs lokal, Knowledge Graph, atau connector yang tersedia.
4. Credibility Scorer memberi nilai source.
5. Evidence Extractor membuat evidence pack.
6. Summarizer menghasilkan brief dengan confidence dan gaps.
7. Knowledge Linker menyimpan ringkasan aman ke Knowledge Graph bila tersedia.

## Batasan

- Tidak ada crawler tersembunyi.
- Tidak bypass paywall.
- Tidak membuat citation palsu.
- Jika connector search tidak tersedia, hasil ditandai degraded/unknown.
- Tidak menulis file repo langsung dari runtime bot.

## Modul

- `src/research/research-task-planner.js`
- `src/research/source-collector.js`
- `src/research/source-credibility-scorer.js`
- `src/research/evidence-extractor.js`
- `src/research/research-summarizer.js`
- `src/research/research-knowledge-linker.js`
- `src/research/research-safety-gate.js`
