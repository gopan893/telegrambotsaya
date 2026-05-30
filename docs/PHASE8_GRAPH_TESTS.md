# Phase 8 Graph Tests

## Automated Checks

```bash
node --check telebot.js
node --check src/ai-os/knowledge-graph.js
node --check src/ai-os/semantic-relationship-engine.js
node --check src/ai-os/concept-extractor.js
node --check src/ai-os/graph-retriever.js
node --check src/ai-os/graph-summarizer.js
node --check src/ai-os/graph-natural-integration.js
node scratch/test-knowledge-graph.js
node scratch/test-aios-foundation.js
node scratch/test-phase7-natural-aios.js
```

## Manual Telegram Checklist

| Step | Input | Expected |
| --- | --- | --- |
| 1 | `/remember Saya memakai PostgreSQL untuk persistent memory dan Redis untuk cache bot AI` | Memory tersimpan dan graph update tidak crash. |
| 2 | `/memory` | Memory terbaru tampil. |
| 3 | `/graph` | Ringkasan nodes, edges, top concepts, technologies, risks. |
| 4 | `/graph PostgreSQL` | Ringkasan PostgreSQL dan relasi terkait. |
| 5 | `/concepts` | Konsep terpenting tampil. |
| 6 | `/relate PostgreSQL | persistent memory | supports | PostgreSQL menyimpan memory jangka panjang` | Relasi manual tersimpan. |
| 7 | `/graphsearch memory` | Node/edge memory relevan tampil. |
| 8 | `/goaladd Bangun AI OS production | Membuat bot dengan memory, workflow, graph, dan ops | high` | Goal tersimpan dan graph link dibuat. |
| 9 | `/workflowadd Stabilkan knowledge graph | Hubungkan memory, goal, workflow, dan insight` | Workflow tersimpan dan graph link dibuat. |
| 10 | `/graphstats` | Statistik node, edge, type, relationship, low confidence. |
| 11 | `/graphdeps` | Dependency utama tampil atau pesan belum ada dependency eksplisit. |
| 12 | `/graphrisks` | Risk graph tampil atau pesan belum ada risk eksplisit. |
| 13 | `Apa hubungan antara PostgreSQL, Redis, dan memory bot saya?` | Natural graph integration menjawab dari graph context. |
| 14 | `Apa konsep penting dari project ini?` | Konsep penting tampil, bukan fallback berat. |
| 15 | `Apa dependency terbesar dari roadmap bot saya?` | Dependency graph dipakai jika ada. |
| 16 | `Halo` | Tidak mengaktifkan graph context. |
| 17 | `25*4` | Tidak mengaktifkan graph context. |

## Safety Checks

- Teks yang mengandung token/API key/password tidak boleh disimpan ke graph.
- Query graph dibatasi top-k, tidak load semua node/edge ke prompt.
- Graph module error harus fallback tanpa crash.
- `/graphprune` tidak menghapus memory/goal/workflow utama.
