# Operasi dan deployment

## Lingkungan

Buat proyek Vercel frontend/API, layanan Railway socket, database PostgreSQL, bucket audio Supabase publik dengan CORS, dan SMTP. Gunakan akun/provider milik pengelola. Staging dan produksi harus mempunyai database, secret, storage, serta origin yang terpisah.

- `APP_URL` dan `NEXTAUTH_URL`: URL HTTPS frontend, tanpa trailing slash.
- `NEXT_PUBLIC_SOCKET_URL`: URL HTTPS Railway; nilai ini ditanam saat frontend dibuild.
- `NEXTAUTH_SECRET` dan `SOCKET_SECRET`: dua nilai acak berbeda minimal 32 karakter. Secret socket harus sama pada frontend API dan server socket.
- `DATABASE_URL`: gunakan batas connection pool sesuai paket database. Jangan membuka database ke publik tanpa autentikasi/TLS.
- Railway menjalankan `npm run socket`, port dari `SOCKET_PORT` atau `PORT`. Jalankan satu replica awal; PostgreSQL menjaga state durable.
- Migrasi dijalankan satu kali sebagai tahap rilis sebelum aplikasi baru diarahkan ke traffic.
- Provisi SMTP serta alamat pengirim terverifikasi; uji register, resend, dan reset pada staging.
- Seed unit, impor konten, dan beri admin lewat ADMIN_EMAIL hanya setelah akun tersebut terverifikasi.

## Rilis

1. `npm ci`, `npm run typecheck`, pengujian domain/integrasi dan build.
2. Ambil backup database sebelum migrasi; jalankan `npm run db:migrate` di staging, lalu produksi setelah tervalidasi.
3. Jalankan socket dan frontend dengan konfigurasi sesuai origin.
4. `npm run release:check` harus berhasil; lengkapi gerbang manual di RELEASE.md.
5. Uji sesi host + guest, replay, reconnect, dan reset password pada URL staging.
6. Catat versi rilis, timestamp migrasi, hasil load test, serta persetujuan pengajar sebelum traffic publik.

## Backup dan restore

Aktifkan backup terkelola harian dengan retensi minimal tujuh hari. Selain itu gunakan `pg_dump --format=custom --file=backup.dump` dengan koneksi lewat variabel libpq/secret manager, bukan password di log atau argumen publik. Enkripsi dan batasi akses hasil backup.

Uji restore ke **database staging kosong yang khusus untuk restore**, dengan `pg_restore --exit-on-error --dbname=<restore_database> backup.dump`. Jangan menggunakan `--clean` terhadap database aktif. Verifikasi jumlah User, Question, Attempt, Room, Answer, dan PointEntry, lalu jalankan login serta satu latihan. Catat waktu pemulihan. Backup belum dianggap terverifikasi sebelum latihan restore berhasil.

Rollback frontend/socket memakai artefak rilis sebelumnya. Jangan menghapus kolom/tabel untuk rollback darurat; migrasi lanjutan perlu pendekatan expand/contract. Jika data rusak, hentikan penerimaan jawaban dan pulihkan ke database baru sebelum memindahkan koneksi.

## Retensi dan pemantauan

Jadwalkan `npm run retention` sekali sehari sebagai pekerjaan Railway. Ini menghapus ruang selesai lebih dari 90 hari beserta jawaban pesertanya, menghapus token/rate-limit kadaluwarsa, dan meredaksi nilai jawaban/timing latihan lama. Ringkasan benar/salah pertama dan hasil attempt tetap tersedia untuk progres akun. Backup mengikuti kebijakan retensinya sendiri.

Pantau GET `/api/platform/health` dan `/health` pada socket. Alert saat gagal berulang, tingkat 5xx naik, koneksi PostgreSQL penuh, atau p95 jawaban >1 detik. Log hanya nama event dan jenis kesalahan; jangan mencatat password, token, header autentikasi, transkrip assessment, atau payload jawaban.

Penambahan replica socket membutuhkan broadcast adapter atau invalidasi lintas replica. Implementasi awal tidak mengklaim skala di atas lima ruang. Sebelum meningkatkan batas, jalankan lagi load test lintas HTTP/socket pada infrastruktur sasaran.
