# Context Leakage & Emotional Support Relevance Guard (Phase 10)

Hotfix ini memperkenalkan pengamanan berlapis untuk mencegah kebocoran data teknis/coding/deployment ke dalam percakapan pribadi/emosional pengguna (`context-relevance-gate.js`) serta menyaring representasi debug internal dari keluaran asisten agar tidak membingungkan pengguna (`output-sanitizer.js`).

## Latar Belakang & Masalah

*   **Masalah Kebocoran Memori**: Ketika pengguna curhat secara emosional (misal: *"pacarku mutusin aku kemarin, aku sedih banget"*), sistem memori kognitif lama sering mengambil memori jangka panjang terdekat seperti status deploy Render terakhir, target pengerjaan project, commit git, atau detail bug teknis lainnya karena dicampur aduk dalam pengambilan memori terpadu. Hal ini merusak empati dan terasa sangat aneh bagi pengguna.
*   **Masalah Kebocoran Debug/Metadata**: Model AI terkadang mencetak prefiks evaluasi internal atau anotasi memori (seperti `[internal]`, `[debug]`, `[memory]`, atau frasa `"Logika internal saya mendeteksi kontradiksi"`) ke dalam balon chat Telegram pengguna.

---

## Solusi Hotfix 2: Gerbang Relevansi & Penyaring Output

Dua modul baru di bawah `src/ai-os/` berkolaborasi untuk mengatasi masalah ini secara tuntas:

### 1. Context Relevance Gate (`context-relevance-gate.js`)
*   **Deteksi Domain Percakapan (`detectConversationDomain`)**: Secara dinamis mengklasifikasikan pesan pengguna ke dalam domain tertentu (`emotional`, `project`, `health`, `general`) berdasarkan analisis leksikal dan riwayat pesan terdekat.
*   **Penyaringan Memori Relevan (`filterRelevantContext`)**: Jika percakapan diklasifikasikan ke dalam domain `emotional` atau `relationship`, gerbang ini secara ketat **memblokir seluruh memori bertipe proyek/teknis** (seperti *deploy, workflow, database, goal, roadmap, render*) agar tidak ikut diumpankan ke model AI.
*   **Prompt Dukungan Emosional Khusus (`buildEmotionalSupportPrompt`)**: Jika pengguna dideteksi membutuhkan dukungan emosional tanpa menyebutkan konteks proyek, sistem akan menyuntikkan instruksi khusus agar AI berperan sebagai asisten yang hangat, suportif, penuh empati, menolak diagnosis klinis palsu, memberikan langkah realistis terkecil, dan menawarkan kontak darurat kesehatan mental nasional jika terdeteksi bahaya melukai diri.

### 2. Output Sanitizer (`output-sanitizer.js`)
*   **Pembersihan Anotasi Internal**: Mendeteksi dan menghapus tag sistem seperti `[internal]`, `[debug]`, `[ops]`, `[memory]` secara otomatis dengan cara yang bersih tanpa meninggalkan tanda kurung kosong `[]` atau baris kosong yang ganjil.
*   **Penulisan Ulang Bahasa Debug**: Frasa kaku seperti *"Logika internal saya mendeteksi kontradiksi"* ditulis ulang secara natural menjadi pemikiran manusiawi seperti *"tadi sempat kurang tepat"*.
*   **Pencegahan Kebocoran Proyek**: Frasa seperti *"berdasarkan target minggu ini dan kondisi deploy terakhir"* otomatis dilebur agar tanggapan tetap natural bagi pengguna non-admin.
*   **Bypass untuk Admin**: Jika admin terverifikasi mengirimkan perintah debug langsung (seperti `/diag`, `/ops`, `/perf`, dll.), output sanitizer **tidak akan memotong informasi debug** agar admin tetap bisa memantau kesehatan sistem dengan akurat.
