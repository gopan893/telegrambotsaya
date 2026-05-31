# Natural Weather, Search, and Online Routing Hotfix (Phase 10)

Hotfix ini memperkenalkan modul `natural-tool-router.js` di dalam `src/tools/` untuk memotong pesan natural chat dari pengguna dan merutekannya langsung ke perkakas eksternal (APIs) yang sesuai sebelum melalui pemrosesan NLP generik yang lebih lambat dan rentan halusinasi.

## Latar Belakang & Masalah

Sebelum hotfix ini diterapkan:
*   Pertanyaan seperti *"bagaimana cuaca di Tokyo?"* sering disalurkan ke model AI umum yang mencoba berdiskusi atau menghasilkan jawaban fiktif/halusinasi karena tidak memiliki akses real-time langsung tanpa integrasi perkakas eksplisit.
*   Pertanyaan seputar pencarian internet dikirimkan ke model AI biasa tanpa memanggil Tavily Search secara proaktif.
*   Pengguna bingung mengapa bot tidak bisa browsing secara mandiri dan membutuhkan penjelasan kapabilitas online bot.

## Solusi Hotfix 1: Natural Tool Router

Pintu gerbang `natural-tool-router.js` bertugas mendeteksi niat (*intent*) alami pengguna dan mengeksekusinya secara instan jika parameter terpenuhi:

1.  **Deteksi Niat Cuaca (`WEATHER`)**:
    *   Mendeteksi kata kunci cuaca seperti `cuaca`, `suhu`, `temperatur`, `hujan`, `prakiraan`, `forecast` di berbagai bahasa (Indonesia & Inggris).
    *   Mengekstrak nama kota secara cerdas menggunakan daftar kata pengisi (*filler words*) seperti `di`, `kota`, `udara`, `suhu`, `ramalan`, dll.
    *   Jika `OPENWEATHER_API_KEY` aktif, modul akan memanggil perkakas cuaca real-time dan mengembalikan hasilnya. Jika belum dikonfigurasi, bot memberikan instruksi yang bersahabat kepada admin untuk menyetel API key.

2.  **Deteksi Niat Pencarian Web (`WEB_SEARCH`)**:
    *   Mendeteksi kata kunci pencarian seperti `cari`, `search`, `terbaru`, `berita`, `update`, `sumber`, `informasi terkini`.
    *   Mengecualikan salam sederhana (`halo`, `selamat pagi`), ekspresi matematika kalkulator (`5 + 5`), atau konversi satuan agar tidak salah dikirim ke search engine.
    *   Membersihkan kata pemicu untuk menghasilkan query pencarian yang optimal.
    *   Memanggil `Tavily Search API` dan merangkum hasilnya secara terstruktur dengan referensi/sumber link jika `TAVILY_API_KEY` dikonfigurasi.

3.  **Penjelasan Kapabilitas Internet (`INTERNET_CAPABILITY_EXPLANATION`)**:
    *   Mendeteksi pertanyaan meta seputar status online bot, seperti *"apakah kamu bisa online?"*, *"bagaimana cara bot ini browsing internet?"*, *"gimana caranya bot online?"*.
    *   Memberikan penjelasan transparan bahwa bot memanggil OpenWeather API dan Tavily Search API di sisi server, serta memberikan instruksi konfigurasi env vars bagi pengembang.

---

## Contoh Aliran Deteksi

*   **Pesan**: *"Berapa suhu udara di Tokyo saat ini?"*
    *   *Intent*: `WEATHER`
    *   *Kota Terkoreksi*: `Tokyo`
    *   *Aksi*: Memanggil `getWeather("Tokyo")` -> Mengembalikan data cuaca real-time.
*   **Pesan**: *"Cari berita AI terbaru di Indonesia"*
    *   *Intent*: `WEB_SEARCH`
    *   *Query Bersih*: `AI Indonesia`
    *   *Aksi*: Memanggil `summarizeSearchWithRefs("AI Indonesia")` -> Mengembalikan ringkasan terstruktur lengkap dengan tautan referensi.
*   **Pesan**: *"Gimana biar bot ini bisa online?"*
    *   *Intent*: `INTERNET_CAPABILITY_EXPLANATION`
    *   *Aksi*: Mengembalikan penjelasan arsitektur API internet bot dan langkah pengaturan key di Render.
