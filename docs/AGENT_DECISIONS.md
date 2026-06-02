# Agent Decision System

Phase 24 menambahkan Agent Decision System untuk membantu user memilih opsi dengan pros/cons, tradeoff, risk score, confidence, dan next steps.

## Kapan Aktif

Decision system aktif untuk pesan seperti:

- `lebih baik PostgreSQL atau Redis?`
- `lanjut phase berapa?`
- `pakai 10 bot langsung atau mulai 4 dulu?`
- `restore backup production aman tidak?`
- `saya bingung pilih arsitektur dashboard`

Sapaan, hitungan, dan dukungan emosional murni tidak memicu decision system.

## Flow

```text
message
-> decision detector
-> option extractor
-> pros/cons engine
-> tradeoff analyzer
-> risk scorer
-> confidence scorer
-> recommendation
-> decision history
```

## Output

Jawaban normal berisi:

- rekomendasi utama;
- alasan ringkas;
- risiko penting;
- confidence;
- langkah berikutnya.

Debug routing tetap hanya untuk command debug atau dashboard test.

## Telegram

```text
/decision <pertanyaan/pilihan>
/compare <opsi A> | <opsi B>
/proscons <topik atau opsi>
/risk <rencana/aksi>
/confidence <rencana/opsi>
/decisions
/decisionhistory
/decisionstatus <decisionId> | <accepted|rejected|deferred>
```

## Safety

- Secret-like input ditolak.
- Restore/import/delete/action berisiko diberi risk high/danger.
- Sistem tidak menjalankan keputusan.
- Write/external/danger tetap butuh executor proposal dan approval eksplisit.
