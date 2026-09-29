# Status dan gerbang peluncuran

Implementasi aplikasi tersedia secara lokal. **Belum boleh dinyatakan siap publik hanya karena build berhasil.**

## Gerbang otomatis

- Typecheck dan build produksi.
- Pengujian lima jenis jawaban, waktu, replay, skor, redaksi assessment, dan ranking.
- Pengujian PostgreSQL: idempotensi, akses attempt, onboarding, cooldown, bonus unik, reconnect, pembatalan, host terputus.
- Pengujian UI desktop dan viewport ponsel.
- `release:check`: konfigurasi produksi, 100 soal practice, 150 assessment, dua unit per level, kelima tipe, audio terjangkau, metadata izin/tinjauan, persetujuan placement.

## Syarat eksternal yang belum tersedia

- Rekaman native final, naskah dan kunci yang ditinjau, serta gambar berizin. CSV contoh hanya draft; tidak dihitung sebagai bank soal final.
- Persetujuan pengajar untuk urutan lima level, ambang placement, penilaian dikte, dan konten.
- Akun/kredensial Vercel, Railway, Supabase, SMTP, domain serta alamat dukungan nyata.
- Pengujian fisik Chrome Android dan Safari iPhone, termasuk autoplay diblokir, Bluetooth, koneksi lambat, dan tab masuk background.
- Load test melalui jaringan deployment sebenarnya: 5 × 30 peserta, sesi penuh, 750 jawaban diakui tersimpan, p95 pengakuan <1 detik.
- Backup harian aktif dan bukti restore berhasil.
- Pilot kelas tanpa bug kritis audio, jawaban, atau skor.

## Batas yang perlu diketahui

Status playback browser tidak membuktikan pengguna mendengarkan. Penguncian jawaban dan batas minimum server mencegah penerimaan terlalu dini, tetapi platform ini bukan sistem ujian berpengawasan.

Dikte sengaja menilai persis teks. Salah satu spasi atau harakat menghasilkan jawaban salah; pengajar harus memastikan ini sesuai tujuan belajar.

Pemeriksaan URL audio otomatis hanya memeriksa keterjangkauan dan tipe media. Durasi, pengucapan, naturalitas, kesesuaian transkrip, dan kepemilikan hak memerlukan tinjauan manusia.
