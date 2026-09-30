<p align="center">
  <img src="public/brand/uzunaka-mark.png" width="96" alt="Logo أذنك" />
</p>

# أذنك — Kuis Bahasa Arab

**Dengarkan. Pahami. Bertumbuh.**

أذنك berarti **telingamu**. Aplikasi ini membantu peserta melatih pemahaman bahasa Arab melalui audio, kuis interaktif, dan pembahasan. Peserta dapat belajar mandiri sesuai progresnya atau mengikuti sesi live bersama pengajar dan teman sekelas.

Antarmuka menggunakan bahasa Indonesia dengan materi Arab fusha. Pengelola menyiapkan soal, rekaman, dan paket materi melalui panel admin tanpa perlu mengubah kode.

> **Status:** dalam tahap pengembangan dan uji coba client. Materi demo dipakai untuk menguji alur aplikasi. Konten final, rekaman native, dan aturan penempatan tetap memerlukan tinjauan pengajar sebelum peluncuran publik.

## Pengalaman belajar

### Latihan mandiri

Peserta membuat akun, mengikuti tes penempatan awal, lalu memilih paket dari level yang sudah terbuka. Setiap soal dimulai dengan audio; jawaban tersedia setelah pemutaran pertama selesai. Peserta dapat memutar ulang audio hingga dua kali, menjawab, lalu mempelajari transkrip dan pembahasannya.

Progres latihan dan poin tersimpan di akun. Tes naik level membuka materi berikutnya, sementara level sebelumnya tetap dapat diulang. Hasil penempatan menjadi titik awal belajar, bukan sertifikasi kemampuan.

### Kuis live

Akun terverifikasi dapat menjadi host dengan memilih paket yang disiapkan admin. Peserta bergabung melalui kode ruang atau QR, termasuk sebagai tamu tanpa akun.

Sesi dimulai dari lobby dan pengecekan audio, dilanjutkan soal, pembahasan, dan leaderboard. Audio diputar di perangkat masing-masing peserta. Host mengatur perpindahan soal dan dapat membatalkan soal jika terjadi kendala audio. Identitas dan jawaban peserta dapat dipulihkan ketika halaman dimuat ulang pada perangkat yang sama.

Batas awal aplikasi adalah **5 ruang aktif dengan maksimal 30 peserta per ruang**. Sesi live tidak mengubah level belajar peserta.

## Lima bentuk soal

| Bentuk soal | Aktivitas peserta |
| --- | --- |
| Pilihan ganda | Memilih jawaban berdasarkan audio yang didengar. |
| Susun kata | Menyusun token kata menjadi urutan yang tepat. |
| Dikte | Menuliskan audio secara tepat, termasuk harakat, spasi, dan tanda baca. |
| Beda bunyi | Mendengarkan rangkaian klip dan membedakan bunyinya. |
| Pilih gambar | Memilih gambar yang sesuai dengan audio. |

Susun kata dapat dikerjakan dengan tap atau keyboard. Dikte menyediakan bantuan input huruf dan harakat Arab. Latihan menampilkan pembahasan setelah menjawab; pada sesi live, pembahasan menunggu fase menjawab selesai. Tes penempatan dan tes naik level hanya menampilkan hasil serta kategori yang perlu dilatih.

## Perjalanan materi

| Level | Fokus |
| --- | --- |
| 1 · Jumlah Murakkabah | Makna kalimat, dhamir, dan perubahan kata kerja. |
| 2 · Hiwar Muta’awassith | Percakapan dan maksud setiap penutur. |
| 3 · Istima’ Muwassa’ | Ide pokok dan detail dalam cerita pendek. |
| 4 · Tamyiz Sauti Lanjutan | Perbedaan bunyi dan pelafalan yang mirip. |
| 5 · Istima’ Tanpa Teks | Pemahaman melalui pendengaran tanpa bantuan teks. |

Urutan ini mengikuti rancangan materi aplikasi dan masih menunggu validasi pengajar.

## Ruang kerja admin

Admin memiliki portal login dan dashboard terpisah dari peserta. Seluruh pengelolaan harian dilakukan melalui menu aplikasi:

- **Ringkasan:** melihat jumlah soal, paket, pengguna, ruang aktif, dan materi yang perlu ditinjau.
- **Bank soal:** membuat lima tipe soal, menentukan kunci dan pembahasan, menyimpan draft, melihat revisi, serta menerbitkan soal.
- **Paket materi:** mengelompokkan soal berdasarkan level dan tema, mengatur urutan, menyalin, serta mengarsipkan paket.
- **Pustaka media:** mengunggah atau merekam audio, mendengarkan pratinjau, dan mengelola gambar beserta metadata izin penggunaannya.
- **Pengguna dan sesi live:** melihat progres peserta, mengatur akses akun, serta memantau dan mengakhiri ruang.
- **Hasil belajar dan laporan:** meninjau hasil latihan dan live, mengekspor CSV, serta menindaklanjuti laporan materi dari peserta.
- **Pengaturan:** mengubah identitas aplikasi dan mencatat tinjauan pengajar untuk akses assessment.

Alur menyiapkan materi: **buat paket → tambahkan soal dan media → pratinjau → tinjau → terbitkan**. Soal latihan yang diterbitkan tersedia untuk latihan mandiri dan pilihan paket host; soal assessment disimpan untuk tes.

## Mencoba aplikasi

Pada lingkungan uji, gunakan akun yang diberikan pengelola atau daftar jika layanan email sudah disiapkan. Portal peserta berada di `/akun`, portal admin di `/admin/login`, dan sesi kelas di `/live`.

Alur utama yang dapat diuji adalah penempatan → latihan → tes naik level; membuat ruang → bergabung sebagai peserta → menyelesaikan sesi; serta membuat paket dan soal melalui admin. Gunakan perangkat dengan speaker atau headphone. Rekaman melalui mikrofon memerlukan izin browser.

## Dokumentasi proyek

Aplikasi dibangun dengan Next.js/React, PostgreSQL/Prisma, NextAuth, dan Socket.io. Petunjuk teknis dipisahkan agar halaman ini tetap berfokus pada aplikasi:

- [Pengembangan lokal, konten demo, dan pengujian](docs/DEVELOPMENT.md)
- [Deployment, backup, dan operasi](docs/OPERATIONS.md)
- [Kontrak API](docs/API.md)
- [Status dan syarat peluncuran publik](docs/RELEASE.md)
- [Identitas visual dan aset merek](docs/BRAND.md)
- [Spesifikasi awal aplikasi](kuis-listening-arab-spec.md)
