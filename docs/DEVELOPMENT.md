# Panduan pengembangan أذنك

Panduan teknis untuk menjalankan, mengisi, dan menguji aplikasi. Pengenalan produk tersedia di [README](../README.md), sedangkan spesifikasi asal berada di [kuis-listening-arab-spec.md](../kuis-listening-arab-spec.md). Jalankan seluruh perintah dari direktori utama proyek.

Platform menggunakan Next.js, PostgreSQL/Prisma, NextAuth, dan Socket.io terpisah.

Nama aplikasi **أذنك** berarti **telingamu**. Logo dari client tersedia di `public/brand/udhunak-logo.jpeg`. Rebranding memperbarui tampilan dan nama bawaan; migrasi hanya mengganti nama pengaturan lama yang tepat bernilai `Istima`, tanpa menimpa nama khusus dari admin. Identitas teknis database, email/password akun fixture, dan istilah pedagogis istima pada materi tetap dipertahankan agar lingkungan development yang sudah ada tetap berfungsi.

## Menjalankan lokal

Butuh Node.js 24 dan npm. Dependensi dikunci di `package-lock.json`.

Di Windows, hentikan proses proyek yang masih berjalan (dev server, socket, dan database lokal) dengan `Ctrl+C` di terminal masing-masing sebelum menjalankan `npm ci`. Proses tersebut dapat mengunci file native di `node_modules` dan menyebabkan `EPERM unlink`. Jika instalasi terputus lalu `tsx` tidak dikenali, selesaikan `npm ci` terlebih dahulu; tidak perlu memasang `tsx` secara global. Instalasi dependensi tidak menghapus data di `.local-postgres` atau konfigurasi `.env`.

```sh
npm ci
npm run local:setup
npm run local:db
```

Biarkan database berjalan.

`local:db` mengikuti port pada `DATABASE_URL` di `.env`. Jika Windows menolak port default `55432` dengan `Permission denied`/`EACCES`, ubah port lokal tersebut ke port yang tersedia (misalnya `5543`), lalu jalankan kembali database dan aplikasi.

Terminal kedua:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Terminal ketiga: `npm run socket`. Buka http://localhost:3000. PostgreSQL lokal hanya mendengarkan 127.0.0.1 pada port `DATABASE_URL` (default `55432`). `.env` dan database lokal diabaikan Git. Alternatif: gunakan PostgreSQL sendiri atau `docker compose up -d`, lalu sesuaikan `DATABASE_URL`.

Email memerlukan SMTP; Docker Compose menyediakan Mailpit di port 1025 dan kotak masuk di http://localhost:8025. Tanpa SMTP, dashboard tetap dapat dibuka tetapi pendaftaran/verifikasi belum bisa diselesaikan. Tidak ada bypass verifikasi atau akun admin bawaan. Setelah mendaftar dan verifikasi, isi `ADMIN_EMAIL` lalu jalankan seed kembali untuk memberi akun tersebut akses admin.

Seed membuat 10 unit **tanpa soal publik**. Audio native, gambar berizin, dan persetujuan pengajar tidak dibuat otomatis. Halaman kosong mencerminkan kesiapan konten sebenarnya.

### Fixture untuk mencoba aplikasi

Saat masih mengembangkan aplikasi, siapkan bank soal lokal dengan:

```sh
npm run db:seed:demo
```

`db:seed:demo` membuat 10 paket, 100 soal latihan, 150 soal assessment, kelima tipe renderer, audio `public/media/test-tone.wav`, gambar `public/media/test-image.svg`, dan menandai konfigurasi placement sebagai fixture yang disetujui. Akun dummy yang tersedia adalah `admin@istima.local`, `user1@istima.local`, dan `user2@istima.local` dengan password yang tercatat di sesi development. Setelah itu, masuk sebagai user untuk mencoba latihan dan membuat ruang dari `/live`; masuk sebagai admin untuk membuka `/admin`.

Untuk mencoba materi yang lebih realistis, jalankan `npm run db:seed:realistic`. Perintah ini membuat paket **Kegiatan sehari-hari · Demo audio Arab** dengan 10 soal, seluruh lima tipe soal, audio Arab sintetis, dan ilustrasi SVG. Paket ditandai `developmentOnly`, sehingga tersaring dari katalog dan sesi production. Audio sintetis hanya untuk uji alur; jangan dipublikasikan sebagai rekaman native.

Fixture memakai audio/gambar lokal dan tidak boleh dipakai sebagai konten publik. Untuk konten produksi, gunakan pipeline CSV, rekaman native, lisensi, dan tinjauan pengajar.

## Konten

1. Siapkan rekaman native dan izin penggunaannya. Gunakan nama file berversi; jangan menimpa aset yang sudah dipakai sesi.
2. Upload dengan `npm run content:upload -- path/audio.mp3`. Storage harus mengizinkan pemutaran publik dan CORS untuk origin aplikasi.
3. Isi `content/template.csv`. `audio`, `options`, dan `accepted` merupakan JSON dalam sel CSV. Nilai `duration` adalah durasi klip dalam detik; verifikasi sesuai rekaman.
4. `npm run content:import -- path/bank.csv --dry-run`, lalu tanpa `--dry-run` untuk mengimpor draft secara atomik.
5. Preview di `/admin`, dengarkan semua klip, periksa kunci/transkrip/penjelasan dan hak penggunaan. Tandai metadata tinjauan melalui impor revisi, lalu terbitkan.
6. Admin mencatat persetujuan pengajar untuk aturan placement sebelum tes dibuka.

Tipe pilihan ganda, beda bunyi, dan gambar menggunakan ID opsi sebagai kunci. Susun kata menggunakan array ID token unik; setiap alternatif harus mengandung semua token tepat sekali. Dikte memakai tepat satu string kunci, termasuk harakat/spasi/tanda baca. String dinormalisasi NFC saja.

Format audio: `[{"url":"https://…/v1.mp3","duration":12,"native":true,"license":"Nomor/rujukan izin","reviewed":true}]`.

Untuk soal gambar, setiap opsi membutuhkan `image`, `license`, dan `text` sebagai alternatif aksesibel. Jangan menulis alt text yang membocorkan kunci secara eksplisit. Untuk beda bunyi, minimal dua klip. Metadata `native`/`reviewed` adalah pernyataan admin, bukan deteksi otomatis.

## Perilaku penting

- Kunci, transkrip, dan penjelasan tidak dikirim sebelum reveal. Assessment tidak membuka ketiganya sama sekali kepada peserta.
- Semua mutasi jawaban dan ledger berada dalam transaksi. ID soal + pemilik jawaban unik; pengiriman ulang mengembalikan hasil yang sudah tersimpan.
- Konfirmasi akhir audio memulai timer setelah server memeriksa durasi minimum. Ini membatasi jawaban terlalu cepat, bukan membuktikan peserta mendengarkan.
- Live memakai batas global 15 detik + durasi + waktu menjawab. Replay tidak menghentikan timer. Status peserta disimpan di PostgreSQL, bukan memori socket.
- Socket menyiarkan invalidasi snapshot; klien mengambil proyeksi yang sudah diotorisasi lewat HTTP. Polling tiga detik menjadi fallback ketika socket putus. Host heartbeat lima detik; setelah sepuluh menit tanpa host ruang berakhir.
- Sesi live tidak membuka level. Assessment memakai config `placement-v1`. Penempatan awal dan urutan level menunggu validasi pengajar.
- Token guest tersimpan pada perangkat. Kehilangan token berarti tidak dapat memulihkan identitas guest; token tidak ditaruh dalam URL atau QR.

## Validasi

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Pengujian integrasi hanya diaktifkan dengan `RUN_DB_TESTS=true` dan `DATABASE_URL` yang menunjuk database **istima_test**. Migrasikan database tersebut terlebih dahulu. Jangan gunakan database produksi.

`npm run test:load` juga wajib menggunakan `istima_test`. Ini menguji layanan dan transaksi database untuk 5 × 30 peserta; bukan pengganti pengukuran jaringan end-to-end Vercel–Railway. Fixture dihapus setelah selesai. UI mobile otomatis menggunakan emulasi Chromium; verifikasi Safari iPhone dan Chrome Android fisik tetap diperlukan.

## Deployment dan operasi

Lihat [OPERATIONS.md](OPERATIONS.md), [API.md](API.md), dan [RELEASE.md](RELEASE.md). `vercel.json`, `railway.json`, migrasi awal, CI, pemeriksaan rilis, dan pekerjaan retensi disediakan. Menambahkan konfigurasi deployment tidak berarti aplikasi sudah diterbitkan.

## Panel admin visual

Masuk dengan akun admin untuk langsung menuju `/admin`. Area ini memiliki navigasi sendiri: Ringkasan, Bank soal, Paket materi, Media, Pengguna, Sesi live, Laporan, dan Pengaturan.

1. Buat paket di **Paket materi**; isi judul, level, tema, dan deskripsi.
2. Pilih **Atur soal**, lalu **Buat soal baru**. Formulir mendukung kelima tipe soal, pilihan kunci, token berulang dan alternatif urutan, dikte persis, gambar, timer, transkrip, serta pembahasan.
3. Gunakan **Tambahkan audio** untuk memilih rekaman, mengunggah file, atau merekam mikrofon. Durasi file diukur oleh browser. Rekaman dapat didengarkan sebelum disimpan. Isi izin penggunaan dan metadata peninjauan audio sesuai keadaan sebenarnya.
4. Simpan sebagai draft, gunakan pratinjau, kemudian terbitkan dari bank soal. Soal latihan terbit otomatis tersedia di paket latihan dan pilihan host live. Assessment tetap hanya digunakan oleh tes.
5. Gunakan menu lainnya untuk mengatur role, menutup ruang live, menindaklanjuti laporan, dan mencatat tinjauan pengajar.

Fitur pengelolaan tambahan tersedia tanpa perubahan kode: salin atau arsipkan paket, atur urutan soal, pindahkan soal dalam level yang sama, lihat riwayat revisi dan pulihkan versi sebagai draft, cari seluruh akun dengan pagination, lihat riwayat latihan pengguna, nonaktifkan akun, ubah identitas aplikasi, serta ekspor hasil paket dan sesi live ke CSV dari menu **Hasil belajar**.

Upload media dari panel saat development disimpan di `.local-runtime/admin-media` dan disajikan melalui `/media/uploads/…`. Untuk staging/production, isi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_AUDIO_BUCKET` (publik), dan `SUPABASE_UPLOAD_BUCKET` (privat). Panel mengunggah file langsung ke bucket sementara Supabase lalu memvalidasi dan memindahkannya ke bucket publik; ini menghindari batas request serverless Vercel. Bucket upload harus privat, memiliki batas maksimal 20 MB, dan bucket audio harus mengizinkan pemutaran dari origin aplikasi. Rekaman mikrofon memerlukan izin browser dan localhost atau HTTPS. Format: MP3, WAV, OGG, M4A, WebM, PNG, JPG, WebP; maksimum 20 MB dan 180 detik per klip.

Uji authoring lokal (menggunakan akun dummy admin dan membersihkan paket/soal uji): set `E2E_ADMIN=true` dan `E2E_EXTERNAL=true`, lalu jalankan `npx playwright test tests/e2e/admin.spec.ts`. Audio dan gambar hasil pengujian tetap berada di direktori media lokal.

Login dipisahkan: `/admin/login` untuk admin, `/akun` untuk pengguna biasa. Server memeriksa role sesuai portal login; login admin tidak menyediakan pendaftaran publik. Keluar dari dashboard admin kembali ke `/admin/login`.
