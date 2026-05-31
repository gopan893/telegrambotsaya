# Knowledge Graph

Phase 8 menambahkan knowledge graph ringan untuk menghubungkan memory, goal, workflow, insight, project, teknologi, risiko, dan keputusan.

## Cara Kerja

Graph terdiri dari:

- Node: konsep seperti `PostgreSQL`, `persistent memory`, `AI OS`, `goal`, `workflow`, `risk`.
- Edge: relasi antar node seperti `supports`, `depends_on`, `risk_for`, `linked_to_goal`, `contradicts`.

Setiap relasi menyimpan:

- `confidence`
- `weight`
- `evidence`
- `source`
- `occurrenceCount`

Relasi confidence rendah tetap boleh disimpan, tetapi output akan memberi sinyal bahwa evidence masih terbatas.

## Command Telegram

```text
/graph
/graph <konsep>
/concepts
/relate <konsep A> | <konsep B> | <relationship> | <evidence optional>
/graphsearch <query>
/graphrisks
/graphdeps
/graphprune
/graphstats
```

Contoh:

```text
/remember Saya memakai PostgreSQL untuk persistent memory dan Redis untuk cache bot AI
/graph
/graph PostgreSQL
/relate PostgreSQL | persistent memory | supports | PostgreSQL menyimpan memory jangka panjang
/graphsearch memory
```

## Relationship Type

Relationship minimal:

- `related_to`
- `supports`
- `contradicts`
- `depends_on`
- `part_of`
- `improves`
- `blocks`
- `belongs_to_project`
- `linked_to_goal`
- `linked_to_workflow`
- `derived_from`
- `evidence_for`
- `risk_for`
- `solution_for`
- `causes`
- `uses`
- `requires`
- `evolves_into`
- `similar_to`

## Sumber Data

Graph terisi secara ringan dari:

- `/remember`: membuat memory node dan konsep terkait.
- `/goaladd`: membuat goal node dan link ke konsep.
- `/workflowadd`: membuat workflow node dan link ke konsep.
- `/insight`: membuat insight node dan link ke konsep.
- `/relate`: menambah relasi manual dengan evidence.

Jika graph update error, command utama tetap sukses.

## Natural Graph Integration

Bot memakai graph context saat chat natural mengandung sinyal seperti:

- `Apa hubungan antara X dan Y?`
- `Apa konsep penting dari project ini?`
- `Apa dependency roadmap saya?`
- `Apa risiko yang terhubung dengan goal saya?`
- `Apa yang bertentangan dari rencana saya?`

Bot tidak mengaktifkan graph untuk sapaan sederhana, hitungan sederhana, atau command eksplisit yang sudah punya handler.

## Guard dan Pruning

Graph guard mencegah penyimpanan teks yang terlihat seperti:

- token
- API key
- password
- secret
- private key
- credential
- full connection string

Limit default:

- 500 node per user
- 1200 edge per user
- 20 alias per node
- top-k retrieval 8 node dan 12 edge
- summary context maksimal sekitar 2000 karakter

`/graphprune` membersihkan node/edge stale atau low-value tanpa menghapus memory utama.

## Batasan

- Belum memakai vector database.
- Belum memakai Neo4j.
- Concept extraction masih heuristic ringan.
- Relasi semantic adalah sinyal bantu, bukan bukti final.
- Untuk keputusan besar, tetap perlu validasi manual dan evidence tambahan.
