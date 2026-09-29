# Spesifikasi Proyek: Kuis Listening Bahasa Arab (Kahoot-style)

> Dokumen ini adalah spesifikasi konsep lengkap untuk digunakan sebagai konteks AI coding agent. Ikuti keputusan yang tercantum di sini secara konsisten selama development.

## 1. Konsep Umum

Website kuis interaktif real-time mirip Kahoot, tapi fokus khusus pada **listening comprehension bahasa Arab**.

- **Target audiens**: level menengah (bukan pemula/pengenalan huruf hijaiyah dasar)
- **Target promosi**: kampus-kampus, dosen, dan mahasiswa (kemungkinan besar prodi Bahasa Arab/PBA/Sastra Arab/PAI)
- **Diferensiator utama**: bukan kuis teks biasa — seluruh soal berpusat pada audio, dengan pertimbangan linguistik Arab yang serius (harakat, RTL, kecepatan bicara natural)

---

## 2. Struktur Konten & Level

Level disusun untuk pembelajar menengah (skip level dasar/hijaiyah):

| Level | Fokus | Karakteristik |
|---|---|---|
| Jumlah Murakkabah | Kalimat majemuk, dhamir, fi'il madhi/mudhari' | Kecepatan bicara natural |
| Hiwar Muta'awassith | Dialog 6-10 baris, 2-3 penutur | Idiom sederhana, intonasi natural |
| Istima' Muwassa' | Paragraf/cerita/berita pendek (30-60 detik) | Pertanyaan pemahaman: ide pokok, detail, kesimpulan |
| Tamyiz Sauti Lanjutan | Diskriminasi bunyi tingkat menengah | ة vs ه akhir kata, tanwin, idgham/ikhfa sederhana |
| Istima' Tanpa Teks | Blind listening, tanpa opsi lihat teks Arab sebelum jawab | Melatih pemahaman murni dari bunyi |

**Poin desain penting untuk level menengah:**
- Audio menggunakan kecepatan bicara natural (bukan di-slow-down seperti level pemula)
- Teks pilihan jawaban sengaja dikurangi harakatnya (mode partial/none) — melatih baca tanpa harakat penuh
- Distractor (pengecoh jawaban) dibuat halus/mirip secara bunyi atau makna (bukan yang jelas beda jauh)

**Hierarki data**: Level → Unit/Paket Soal (tematik) → Soal individual

**Tema unit yang relevan untuk level menengah**: percakapan formal (wawancara, kantor/kampus), berita/pengumuman pendek, narasi kisah (qashash) pendek, debat/diskusi ringan.

**Tipe soal listening yang divariasikan:**
- Pilih gambar sesuai audio (mufrodat visual)
- Dengar lalu susun urutan kata jadi kalimat benar
- Dengar dua audio mirip, pilih mana yang beda (bedain huruf mirip pelafalan, mis. ص vs س)
- Dikte pendek (ketik apa yang didengar) — level lanjut

**Struktur data soal:**
```
{
  id, level, tipe_soal (pilihan_ganda / urutkan / dikte / beda_bunyi / pilih_gambar),
  audio_url,
  teks_arab (opsional, ditampilkan setelah jawab),
  harakat_mode (full / partial / none),
  pilihan: [...],
  jawaban_benar,
  waktu_batas (detik),
  poin_dasar,
  pool (practice / assessment)
}
```

**Penting**: soal dibagi menjadi dua pool terpisah — **practice pool** (latihan bebas) dan **assessment pool** (khusus test) — supaya user tidak "hafal jawaban" dari latihan lalu lolos test tanpa benar-benar siap. Assessment pool butuh minimal 20-30 soal per level agar bisa dirandom tiap sesi test.

---

## 3. Placement Test = Level-Up Test (Unified System)

Satu mekanisme test dipakai untuk dua fungsi (bukan sistem terpisah):

- **Onboarding**: wajib untuk user baru, sampel soal dari semua level → menentukan titik mulai
- **Level-up**: muncul setelah user menyelesaikan semua unit di level saat ini (atau capai threshold akurasi ≥75%) → gate untuk naik ke level berikutnya. Komposisi soal: 70% dari level tujuan, 30% dari level saat ini (validasi kesiapan)

**Struktur umum test:**
```
{
  tipe_test: "onboarding" | "level_up",
  level_asal (khusus level_up),
  level_tujuan,
  jumlah_soal: 10-15,
  komposisi: { dari_level_tujuan: 70%, dari_level_saat_ini: 30% },
  threshold_lulus: 70-75%,
  breakdown_per_kategori
}
```

**Hasil:**
- Lulus → naik level, dapat badge/notifikasi pencapaian
- Gagal → tetap di level sekarang, tanpa penalti poin, dapat rekomendasi unit spesifik untuk diulang berdasarkan kategori yang lemah

**Catatan**: Fixed test set dipakai dulu di awal (bukan adaptive) — adaptive test (soal makin sulit/mudah mengikuti performa) dicatat sebagai pengembangan lanjutan.

---

## 4. Gamifikasi & Skema Poin

### Poin dasar per jawaban benar
| Level | Poin dasar |
|---|---|
| Jumlah Murakkabah | 100 |
| Hiwar Muta'awassith | 150 |
| Istima' Muwassa' | 200 |
| Tamyiz Sauti Lanjutan | 150 |
| Istima' Tanpa Teks | 250 |

### Bonus kecepatan
- Timer mulai dihitung **setelah** audio selesai diputar penuh minimal 1x (bukan dari soal muncul)
- Formula: `bonus = poin_dasar * (sisa_waktu / total_waktu) * 0.5`
- Cap maksimal bonus: 50% dari poin dasar

### Penalti replay audio (mempengaruhi bonus kecepatan saja, bukan poin dasar)
| Replay | Efek ke bonus kecepatan |
|---|---|
| 0x | 100% |
| 1x | 60% |
| 2x (maksimal) | 25% |

### Streak multiplier (dalam 1 sesi, mengalikan poin dasar + bonus kecepatan)
| Streak beruntun | Multiplier |
|---|---|
| 1-2 benar | x1.0 |
| 3-5 benar | x1.2 |
| 6-9 benar | x1.5 |
| 10+ benar | x2.0 |

Reset ke x1.0 saat jawaban salah.

### Poin lain
- **Level-up test lulus**: flat bonus 1000 poin (tidak tergantung level), gagal tidak ada penalti
- **Practice mode (solo)**: semua poin dikali 0.5
- **Daily streak**: hari 1-6 → +10 poin/hari (login + selesaikan minimal 1 sesi); hari ke-7 kelipatan → bonus lebih besar (mis. +100 di hari-7, +200 di hari-14)

### Badge/Achievement (contoh)
- "Master of Tamyiz" — akurasi 90%+ konsisten di kategori tamyiz sauti
- "Blind Listener" — lulus sesi istima' tanpa-teks tanpa replay sama sekali
- "Naik Kelas" — badge per level-up yang lolos
- "Konsisten" — streak 7/30/100 hari

### Leaderboard
- Per sesi live (real-time, reset tiap sesi)
- Per level/kategori (bukan global — supaya adil antar level berbeda)
- Weekly (reset mingguan, agar user baru tidak minder)

---

## 5. Content Authoring

- **Model**: **closed** (hanya pemilik/admin yang membuat konten di tahap awal). **Open/multi-host** (siapa saja bisa buat paket soal sendiri, perlu moderasi) dicatat sebagai rencana pengembangan lanjutan.
- **Sumber audio**: kombinasi **TTS Arab** (untuk draft/validasi platform cepat) + **rekaman native speaker** (untuk konten final, terutama sebelum demo/pitch ke kampus — kredibilitas linguistik penting karena target audiens termasuk dosen ahli bahasa Arab)
- **Format input soal**: spreadsheet/CSV bulk authoring (kolom: id_soal, level, tema, tipe_soal, nama_file_audio, teks_arab, harakat_mode, pilihan a-d, jawaban_benar, pool) → script import (Python/Node) baca CSV → insert ke database
- **Audio**: diupload terpisah ke storage, di-link berdasarkan nama file yang konsisten
- **Admin panel ringan**: preview soal (dengar audio + lihat pilihan jawaban) untuk QA, toggle status draft/published. Form create/edit lengkap menyusul belakangan (bukan prioritas awal).
- **Validasi konten**: sebelum publish luas, direview oleh dosen/pakar bahasa Arab (soft-launch: pitch ke 1-2 dosen dulu untuk validasi & feedback sebelum scale ke kampus lain)

---

## 6. Alur Sesi Live

- **Host mulai sesi**: login → pilih paket soal (level + unit/tema) → sistem generate room code (4-6 digit/huruf) + QR code, ditampilkan untuk proyektor
- **Peserta join**: input room code + nama. Dua mode: **guest** (sekali pakai, progress tidak ter-track) dan **logged-in** (progress & poin nyambung ke akun)
- **Kontrol pace soal**: kombinasi — default **manual** (host klik "next"), dengan opsi **auto-advance** (otomatis lanjut saat timer habis/semua sudah jawab)
- **Host view real-time**: live counter "X dari Y peserta sudah jawab", bar chart distribusi jawaban per soal (A/B/C/D), leaderboard live (top 5)
- **Akhir sesi**: leaderboard final, host bisa export hasil (jawaban & akurasi tiap peserta) — berguna untuk keperluan penilaian dosen

---

## 7. UI/UX

### Prinsip desain
**Minimalis dengan aksen/tema ke-Arab-araban** — bukan "Arab yang ramai". Kesan akhir: bersih, tenang, tapi identitas Arab terasa lewat detail (font, aksen warna, motif tipis), bukan lewat keramaian visual.

### Palet warna
- Base: putih/cream/off-white
- Aksen: gold (emas) sebagai warna utama (CTA/button) + hijau tua/emerald sebagai aksen sekunder (kategori/badge) — maksimal 2 warna aksen + 1 base

### Tipografi
- Teks Arab: font jelas & clean (Noto Naskh Arabic / Lateef), bukan kaligrafis untuk body text
- Teks Latin/UI: sans-serif modern, kontras dengan font Arab

### Ikonografi
- **Wajib pakai icon library seperti Lucide (lucide-react) — TIDAK menggunakan emoji** untuk elemen UI apapun (navigasi, badge, indikator, feedback benar/salah, dll)
- Contoh: `RotateCcw`/`Repeat` untuk replay, `CheckCircle2`/`XCircle` untuk feedback jawaban, `Award`/`Trophy`/`Star` untuk badge, `Play`/`Pause`/`ChevronRight` untuk navigasi

### Elemen dekoratif
- Pola geometris Arab-Islamic dipakai minim & subtle (border tipis di card, watermark opacity rendah di corner, bukan full background pattern)
- Shape language: lengkungan khas arsitektur Islam (mihrab/kubah) sebagai inspirasi bentuk card/button/frame audio player

### Audio playback
- **Menggunakan waveform visualizer** (via Wavesurfer.js) — animasi gelombang suara mengikuti audio, bukan tampilan minimal polos
- **Manual play sebagai default** (user klik tombol play sendiri) — bukan auto-play, karena kesiapan mental penting untuk listening comprehension
- Auto-play fallback jika user terlalu lama menunda di sesi live (agar sesi tetap berjalan lancar)
- Progress bar tipis di bawah waveform
- Indikator sisa replay ditampilkan eksplisit (ikon + angka, mis. "2x tersisa")
- Tombol replay disabled sebelum audio pertama selesai diputar penuh
- Pilihan jawaban disabled/blur sebelum audio selesai, aktif dengan animasi fade-in/slide-in setelah audio selesai

### RTL handling
- Bukan full-RTL app — mixed-direction: container teks Arab di-set `dir="rtl"`, layout global (timer, skor, navigasi) tetap LTR

### Reveal jawaban
- Highlight pilihan user (benar/salah) + tampilkan jawaban benar
- Tombol "lihat teks Arab" muncul setelah jawab (bukan sebelum, agar tidak dipakai menyontek)
- Transkrip lengkap ditampilkan untuk soal hiwar/istima' paragraf

### Audio check
- Layar test audio sebelum sesi live dimulai ("test audio kamu")
- Reminder pakai headphone untuk hasil terbaik (terutama sesi live di kelas)

---

## 8. Skema Data/Database (Garis Besar)

```
User
├── id, nama, email, role (student/dosen/admin), level_saat_ini, total_poin, streak_count
├── has many → Progress, SessionParticipation, TestAttempt
└── has many → Badge (many-to-many via UserBadge)

Level
├── id, nama, urutan, poin_dasar

Unit (Paket Soal)
├── id, level_id (FK), tema, judul, deskripsi
└── has many → Soal

Soal
├── id, unit_id (FK), tipe_soal, audio_url, teks_arab, harakat_mode,
│   pilihan_jawaban (JSON), jawaban_benar, pool (practice/assessment), waktu_batas

Sesi Live
├── id, host_id (FK User), unit_id (FK), room_code, status (waiting/active/ended), mode_pace (manual/auto)
└── has many → SessionParticipation

SessionParticipation
├── id, sesi_id (FK), user_id (FK, nullable jika guest), nama_guest,
│   skor_sesi, jawaban_detail (JSON: soal_id, jawaban_dipilih, benar/salah, waktu_jawab, replay_count)

Progress
├── id, user_id (FK), level_id (FK), unit_id (FK), status, akurasi_persen, terakhir_diakses

TestAttempt
├── id, user_id (FK), tipe (onboarding/level_up), level_asal, level_tujuan,
│   skor_total, breakdown_kategori (JSON), lulus (boolean)

Badge
├── id, nama, deskripsi, icon_key (referensi Lucide icon), kriteria

UserBadge (junction)
├── user_id (FK), badge_id (FK), earned_at
```

**Keputusan desain:**
- Guest participation ditampung via `user_id` nullable + `nama_guest` di SessionParticipation
- `jawaban_detail` disimpan sebagai JSON (bukan tabel terpisah) untuk MVP — bisa dipecah jadi tabel `Jawaban` nanti kalau butuh analytics granular
- Role User (`student/dosen/admin`) disiapkan dari awal untuk kebutuhan "mode dosen" di masa depan, meski belum aktif di MVP

---

## 9. Aksesibilitas & Device

- **Player view**: mobile-first (mahasiswa akses via HP, baik saat sesi live maupun practice mode)
- **Host view**: desktop-oriented (dosen pakai laptop + proyektor, perlu tampilkan lebih banyak data sekaligus)
- Audio di-preload sebelum soal muncul (bukan streaming on-demand) untuk menghindari lag
- Indikator status koneksi di layar peserta
- Kontras warna palet gold/emerald perlu dicek terhadap keterbacaan teks Arab
- Font Arab punya minimum size cukup besar, idealnya ada opsi font size adjustment
- Subtitle/caption toggle untuk aksesibilitas — dicatat sebagai fitur nice-to-have (bukan prioritas MVP)

---

## 10. Scope MVP vs Fase Lanjutan

### 🟢 MVP (wajib ada untuk launch/demo pertama)
- Struktur level dasar (2-3 level dulu, bukan semua 5)
- Unit & soal (practice pool)
- Kuis solo/practice mode
- Sesi live dasar (room code, join, manual pace)
- Sistem poin dasar (poin + bonus kecepatan, TANPA multiplier streak kompleks dulu)
- Waveform + audio playback (manual play, replay terbatas)
- Leaderboard live (per sesi)
- UI minimalis + tema Arab dasar (warna, font, Lucide icon)
- Auth dasar (login/register + guest join untuk sesi live)

### 🟡 Fase 2 (setelah MVP tervalidasi)
- Placement test & level-up test (unified system) — butuh bank soal assessment besar dulu
- Streak harian & multiplier kompleks
- Badge/achievement system
- Semua 5 level lengkap + tamyiz sauti & istima' tanpa teks
- Auto-advance mode di sesi live
- Export hasil sesi
- Distribusi jawaban (bar chart di host view)

### 🔴 Fase 3 / Visi Jangka Panjang
- Open/multi-host content authoring
- Role dosen aktif (assign tugas, monitoring kelas)
- Rekaman native speaker skala penuh
- Subtitle/caption accessibility toggle
- Adaptive placement test

---

## 11. Tech Stack

```
Frontend    : Next.js (React) + Tailwind CSS + Framer Motion + Lucide React + Wavesurfer.js
Backend API : Next.js API routes / Express
Real-time   : Socket.io (di-host terpisah, misal Railway — bukan Vercel serverless)
Database    : PostgreSQL + Prisma ORM
Storage     : Supabase Storage / Cloudinary (untuk file audio)
Auth        : NextAuth.js
Hosting     : Vercel (frontend + API) + Railway (socket server + DB)
```

**Catatan penting**: Next.js/React dipilih (bukan Vue) meskipun pemilik proyek sebelumnya lebih familiar dengan Vue 3 — keputusan ini disengaja karena sekalian ingin belajar React.

### Roadmap development (bertahap, sekaligus jalur belajar React)

1. **Fase 0 — Setup & Fondasi**: init Next.js + Tailwind config, setup Prisma + PostgreSQL (schema awal), setup NextAuth
2. **Fase 1 — Konten Statis**: halaman list level/unit/soal (data dummy), komponen dasar UI (Card, Button, Badge)
3. **Fase 2 — Interaktivitas Client-side**: kuis solo/practice mode jalan penuh, integrasi Wavesurfer.js, timer per soal
4. **Fase 3 — Koneksi Backend**: API routes fetch data asli, simpan hasil kuis ke DB, auth flow lengkap
5. **Fase 4 — Real-time Sesi Live**: setup Socket.io server, room code, join, sinkronisasi soal host-peserta, live leaderboard
6. **Fase 5 — Polish & Gamifikasi**: animasi Framer Motion, sistem poin lengkap, audio check screen
7. **Fase 6 — Content Authoring Pipeline**: script import CSV, admin panel ringan

---

## 12. Prinsip Non-Negosiable (untuk AI Agent)

Poin-poin berikut adalah keputusan final yang harus selalu diikuti secara konsisten:

1. **Tidak pernah pakai emoji sebagai icon UI** — selalu pakai Lucide icon set
2. **Audio playback manual play by default**, bukan auto-play (kecuali fallback di sesi live)
3. **Waveform visualizer** untuk audio player, bukan tampilan minimal polos
4. **Bonus kecepatan hanya berlaku setelah audio diputar penuh minimal 1x** — mencegah user asal klik tanpa dengar
5. **Tech stack: Next.js/React**, bukan Vue
6. **Desain UI minimalis dengan aksen Arab yang subtle** — hindari pola geometris yang ramai/dominan
7. **Practice pool dan assessment pool soal harus terpisah** — user tidak boleh "hafal jawaban" dari latihan lalu lolos test
8. **Content authoring closed** di tahap awal (bukan multi-host)
