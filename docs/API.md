# Kontrak aplikasi

HTTP di `/api/platform`. Respons kesalahan `{ error: string }`; status 400 untuk validasi, 401 belum login, 403 akses ditolak, 404 tidak ditemukan, 409 prasyarat belum terpenuhi, 429 rate limit, 503 layanan tidak tersedia. Mutasi memerlukan Origin yang sama dengan `APP_URL`.

| Endpoint | Fungsi |
|---|---|
| GET catalog | Level, unit terbit, ringkasan akun/progres, ruang host aktif |
| POST attempts | `{kind: practice\|onboarding\|level_up, unitId?}` → `{id}`; melanjutkan attempt aktif yang sesuai |
| GET attempts/:id | Snapshot milik akun yang login; tanpa kunci assessment |
| POST attempts/:id | `{action: play\|heard\|replay\|answer\|next, value?}` |
| POST rooms | `{unitId}` → `{id,code}`; akun terverifikasi |
| POST rooms/join | `{code,name}` → `{id,code,token}` |
| GET rooms/:code | Snapshot per identitas; token guest di `x-participant-token` |
| POST rooms/:code | Perintah playback/jawaban atau `check,ready,start,next,cancel,end,remove`; remove memerlukan participantId |
| POST rooms/:code/ticket | Tiket Socket.io bertanda tangan, berlaku 60 detik untuk handshake |
| POST reports | `{questionId,message}`; akun login, maksimal 5 per jam |
| GET admin | Draft, laporan dan status persetujuan; admin saja |
| POST admin/question | Payload question tervalidasi; versi baru selalu draft |
| POST admin/publish | `{id,publish}`; validasi audio native/tinjauan/izin |
| POST admin/review | `{reviewer,approved}` untuk config placement-v1 |
| GET health | Kesehatan koneksi database |

Auth ada di `/api/auth/*` melalui NextAuth. `/api/account` menerima action `register`, `verify`, `forgot`, `resend`, `reset`, `delete`. Pendaftaran tidak langsung masuk. Penghapusan memerlukan password. Token verifikasi/reset di-hash di database dan berlaku satu jam; reset menaikkan versi autentikasi untuk membatalkan sesi lama.

Socket.io: handshake `{auth:{ticket}}`; event server `snapshot:changed`; event klien `heartbeat`. Semua mutasi berjalan lewat HTTP sehingga validasi, transaksi, dan idempotensi memakai jalur yang sama. Tidak ada broadcast kunci atau snapshot lengkap antar peserta. Klien meminta tiket baru saat reconnect.

Snapshot soal publik berisi prompt, opsi, kategori, harakat, durasi dan URL audio. `accepted`, `transcript`, `explanation`, metadata lisensi dan tinjauan disimpan di server. `feedback` hanya ada setelah jawaban latihan atau reveal live. Snapshot menyertakan `serverNow` untuk koreksi jam perangkat.

Sesi: lobby → check → question → reveal → leaderboard → question/ended. Pembatalan soal menghapus jawaban dan ledger poin soal itu dalam satu transaksi. Snapshot versi soal disalin saat attempt/room dibuat; perubahan konten selanjutnya tidak memengaruhi penilaian yang sedang berjalan.

## Pengelolaan visual

Seluruh endpoint `admin/*` memerlukan akun admin. `GET admin` mengembalikan ringkasan, daftar pengguna tanpa kredensial, paket, soal lengkap, ruang aktif, dan laporan.

- `POST admin/unit`: simpan paket; perubahan level ditolak jika paket sudah berisi soal.
- `POST admin/question`: simpan versi draft; unit dan level harus sesuai. Untuk mengedit, sertakan versi yang terakhir dibaca; versi lama menghasilkan 409.
- `POST admin/delete-question`: `{id}`; hanya draft, snapshot sesi tetap utuh.
- `POST admin/delete-unit`: `{id}`; hanya paket kosong.
- `POST admin/user-role`: `{userId,role}`; perubahan role akun sendiri ditolak.
- `POST admin/end-room`: `{code}`; mengakhiri sesi melalui transaksi state ruang.
- `POST admin/resolve-report`: `{id}`; menghapus laporan yang telah ditangani dari antrean.
- `POST admin/refresh`: menyelesaikan tenggat ruang lalu menyegarkan dashboard.

Media development: `GET /api/admin/media` untuk pustaka, `POST /api/admin/media` untuk multipart `{file,duration}`. Endpoint memeriksa role, Origin, batas 20 MB, tanda format file, dan durasi 0–180 detik. File diberi nama UUID baru dan tersedia di `/media/uploads/:name`; path tidak menerima nama arbitrer. Unggahan lokal ditolak pada mode production. Rekaman dan upload tidak otomatis dinyatakan native atau ditinjau.
