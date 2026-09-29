'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  Plus,
  BookOpen,
  Layers,
  Users,
  Radio,
  Pencil,
  Copy,
  ArrowRight,
  Search,
  RefreshCw,
} from 'lucide-react';
import { levels, typeLabels, type Question } from '@/lib/contracts';
import { useAdmin, type Unit } from './context';
import { QuestionEditor, emptyQuestion } from './question-editor';
import { MediaManager } from './media-manager';
import { BRAND_NAME } from '@/lib/brand';

import { PackageTools, UserControls, AppSettingsForm, AnalyticsPanel } from './controls';

const titles: Record<string, [string, string]> = {
  hasil: ['Hasil belajar', 'Evaluasi latihan, soal, dan hasil sesi live.'],
  ringkasan: ['Dashboard admin', 'Pantau aktivitas dan siapkan pengalaman belajar berikutnya.'],
  soal: ['Bank soal', 'Tulis pertanyaan, tentukan jawaban, dan kelola publikasi materi.'],
  paket: ['Paket materi', 'Kelompokkan soal ke dalam unit latihan dan paket sesi live.'],
  media: ['Pustaka media', 'Kelola rekaman suara dan gambar untuk materi listening.'],
  pengguna: ['Pengguna', 'Lihat progres belajar dan atur akses pengelola.'],
  live: ['Sesi live', 'Pantau ruang belajar yang sedang berlangsung.'],
  laporan: ['Laporan materi', 'Tindak lanjuti kendala yang dilaporkan peserta.'],
  pengaturan: ['Pengaturan', 'Atur akses tes penempatan dan tinjauan pengajar.'],
};
export function AdminSection({ section }: { section: string }) {
  return (
    <>
      <div className="admin-heading">
        <div>
          <div className="eyebrow">
            <bdi dir="rtl">{BRAND_NAME}</bdi> / PENGELOLAAN
          </div>
          <h1>{titles[section][0]}</h1>
          <p>{titles[section][1]}</p>
        </div>
      </div>
      {section === 'hasil' ? (
        <AnalyticsPanel />
      ) : section === 'ringkasan' ? (
        <Overview />
      ) : section === 'soal' ? (
        <Questions />
      ) : section === 'paket' ? (
        <Packages />
      ) : section === 'media' ? (
        <section className="panel">
          <MediaManager />
        </section>
      ) : section === 'pengguna' ? (
        <UserControls />
      ) : section === 'live' ? (
        <Live />
      ) : section === 'laporan' ? (
        <Reports />
      ) : (
        <Settings />
      )}
    </>
  );
}
function Overview() {
  const { data } = useAdmin();
  return (
    <>
      <div className="admin-stats">
        {[
          {
            title: 'Soal terbit',
            value: data.stats.published,
            note: `${data.stats.draft} draft menunggu`,
            icon: BookOpen,
            href: '/admin/soal',
          },
          {
            title: 'Paket materi',
            value: data.units.length,
            note: 'Tersebar di lima level',
            icon: Layers,
            href: '/admin/paket',
          },
          {
            title: 'Pengguna',
            value: data.stats.users,
            note: 'Akun terdaftar',
            icon: Users,
            href: '/admin/pengguna',
          },
          {
            title: 'Ruang aktif',
            value: `${data.stats.activeRooms}/5`,
            note: 'Maksimal 30 peserta per ruang',
            icon: Radio,
            href: '/admin/live',
          },
        ].map((s) => (
          <Link className="admin-stat" href={s.href} key={s.title}>
            <s.icon size={22} />
            <small>{s.title}</small>
            <strong>{s.value}</strong>
            <span>{s.note}</span>
          </Link>
        ))}
      </div>
      <section className="admin-hero">
        <div>
          <span className="eyebrow">MATERI BERAWAL DARI SINI</span>
          <h2>Siapkan pelajaran yang ingin didengar.</h2>
          <p>Mulai dari paket materi, tambahkan soal, lalu unggah atau rekam suara Anda.</p>
        </div>
        <Link className="button gold" href="/admin/soal">
          <Plus size={17} />
          Buat soal
        </Link>
      </section>
      <div className="admin-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Cakupan materi</h2>
            <Link className="text-button" href="/admin/paket">
              Kelola paket <ArrowRight size={15} />
            </Link>
          </div>
          {levels.map((l) => {
            const questions = data.questions.filter((q) => q.level === l.id);
            return (
              <div className="admin-coverage" key={l.id}>
                <span className="status-chip">{l.id}</span>
                <div>
                  <strong>{l.title}</strong>
                  <small>
                    {questions.filter((q) => q.pool === 'practice').length} latihan ·{' '}
                    {questions.filter((q) => q.pool === 'assessment').length} assessment
                  </small>
                </div>
                <span>{questions.filter((q) => q.status === 'published').length} terbit</span>
              </div>
            );
          })}
        </section>
        <section className="panel">
          <h2>Perlu ditinjau</h2>
          <Link className="admin-task" href="/admin/soal">
            <BookOpen size={20} />
            <span>
              <strong>{data.stats.draft} soal draft</strong>
              <small>Periksa audio, kunci, dan penjelasan.</small>
            </span>
            <ArrowRight size={17} />
          </Link>
          <Link className="admin-task" href="/admin/laporan">
            <Layers size={20} />
            <span>
              <strong>{data.reports.length} laporan materi</strong>
              <small>Tindak lanjuti masukan peserta.</small>
            </span>
            <ArrowRight size={17} />
          </Link>
          <Link className="admin-task" href="/admin/pengaturan">
            <Users size={20} />
            <span>
              <strong>{data.review?.approved ? 'Akses tes aktif' : 'Akses tes belum aktif'}</strong>
              <small>{data.review?.reviewer ?? 'Menunggu tinjauan pengajar'}</small>
            </span>
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
function Questions() {
  const { data, busy, mutate } = useAdmin();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Question | null>(null),
    [search, setSearch] = useState(''),
    [unit, setUnit] = useState(params.get('paket') ?? ''),
    [type, setType] = useState(''),
    [pool, setPool] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [destination, setDestination] = useState('');
  if (editing)
    return <QuestionEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />;
  const rows = data.questions.filter(
    (row) =>
      (!unit || row.unitId === unit) &&
      (!type || row.data.type === type) &&
      (!pool || row.pool === pool) &&
      (!status || row.status === status) &&
      [row.data.prompt, row.data.category].some((t) =>
        t.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 12)),
    currentPage = Math.min(page, pages - 1);
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{rows.length} soal</h2>
        <button
          className="button primary"
          disabled={!data.units.length}
          onClick={() => {
            const u = data.units.find((u) => u.id === unit) ?? data.units[0];
            setEditing(emptyQuestion(u.id, u.level));
          }}
        >
          <Plus size={16} />
          Buat soal baru
        </button>
      </div>
      {!data.units.length && <p>Buat paket materi terlebih dahulu.</p>}
      <div className="admin-filters">
        <label className="field">
          Cari soal
          <input
            placeholder="Instruksi atau kategori…"
            value={search}
            onChange={(e) => reset(() => setSearch(e.target.value))}
          />
        </label>
        <label className="field">
          Paket
          <select value={unit} onChange={(e) => reset(() => setUnit(e.target.value))}>
            <option value="">Semua paket</option>
            {data.units.map((u) => (
              <option key={u.id} value={u.id}>
                L{u.level} · {u.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tipe
          <select value={type} onChange={(e) => reset(() => setType(e.target.value))}>
            <option value="">Semua tipe</option>
            {Object.entries(typeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Penggunaan
          <select value={pool} onChange={(e) => reset(() => setPool(e.target.value))}>
            <option value="">Semua penggunaan</option>
            <option value="practice">Latihan & live</option>
            <option value="assessment">Assessment</option>
          </select>
        </label>
        <label className="field">
          Status
          <select value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="published">Terbit</option>
          </select>
        </label>
      </div>
      <div className="actions">
        <span>{selected.length} soal dipilih</span>
        <label className="field">
          Pindahkan ke paket
          <select value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Pilih paket tujuan</option>
            {data.units
              .filter((u) => !u.archived)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  L{u.level} · {u.title}
                </option>
              ))}
          </select>
        </label>
        <button
          className="button outline"
          disabled={busy || !selected.length || !destination}
          onClick={async () => {
            if (
              window.confirm(
                'Pindahkan soal terpilih? Soal menjadi draft di paket tujuan pada level yang sama.',
              ) &&
              (await mutate('move-questions', { ids: selected, unitId: destination }))
            )
              setSelected([]);
          }}
        >
          Pindahkan pilihan
        </button>
        {selected.length > 0 && (
          <button className="text-button" onClick={() => setSelected([])}>
            Batal pilih
          </button>
        )}
      </div>
      <div className="scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pilih</th>
              <th>Pertanyaan</th>
              <th>Paket / tipe</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(currentPage * 12, (currentPage + 1) * 12).map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={'Pilih soal ' + row.data.prompt}
                    checked={selected.includes(row.id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked ? [...ids, row.id] : ids.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                <td className="admin-question-cell">
                  <strong>{row.data.prompt}</strong>
                  <small>
                    {row.data.category} · Versi {row.version} ·{' '}
                    {row.pool === 'practice' ? 'Latihan & live' : 'Assessment'}
                  </small>
                </td>
                <td>
                  {data.units.find((u) => u.id === row.unitId)?.title}
                  <small>
                    Level {row.level} · {typeLabels[row.data.type]}
                  </small>
                </td>
                <td>
                  <span className={'admin-status ' + row.status}>
                    {row.status === 'published' ? 'Terbit' : 'Draft'}
                  </span>
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button className="text-button" onClick={() => setEditing(row.data)}>
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      className="text-button"
                      aria-label="Duplikat soal"
                      onClick={() =>
                        setEditing({
                          ...structuredClone(row.data),
                          id: 'soal-' + crypto.randomUUID(),
                          version: 1,
                        })
                      }
                    >
                      <Copy size={14} />
                      Salin
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          'publish',
                          { id: row.id, publish: row.status !== 'published' },
                          row.status === 'published'
                            ? 'Soal ditarik ke draft.'
                            : 'Soal diterbitkan.',
                        )
                      }
                    >
                      {row.status === 'published' ? 'Tarik ke draft' : 'Terbitkan'}
                    </button>
                    {row.status === 'draft' && (
                      <button
                        className="text-button danger-text"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Hapus soal draft ini? Riwayat sesi yang sudah berjalan tetap tersimpan.',
                            )
                          )
                            void mutate('delete-question', { id: row.id }, 'Soal draft dihapus.');
                        }}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="admin-empty">
          <Search />
          <p>Belum ada soal yang sesuai. Ubah filter atau buat soal baru.</p>
        </div>
      )}
      <div className="admin-pagination">
        <span>
          Halaman {currentPage + 1} dari {pages}
        </span>
        <button
          className="button outline"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Sebelumnya
        </button>
        <button
          className="button outline"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          Berikutnya
        </button>
      </div>
    </section>
  );
}
function Packages() {
  const { data, busy, mutate } = useAdmin();
  const [editing, setEditing] = useState<Unit | null>(null),
    [search, setSearch] = useState('');
  return (
    <>
      <div className="admin-toolbar">
        <label className="field">
          Cari paket
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Judul paket…"
          />
        </label>
        <button
          className="button primary"
          onClick={() =>
            setEditing({
              id: 'paket-' + crypto.randomUUID(),
              title: '',
              theme: '',
              description: '',
              level: 1,
            })
          }
        >
          <Plus size={16} />
          Buat paket
        </button>
      </div>
      {editing && (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await mutate('unit', editing, 'Paket materi tersimpan.')) setEditing(null);
          }}
        >
          <h2>{data.units.some((u) => u.id === editing.id) ? 'Edit paket' : 'Paket baru'}</h2>
          <div className="form-grid">
            <label className="field">
              Judul paket
              <input
                required
                minLength={2}
                maxLength={120}
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="field">
              Level
              <select
                value={editing.level}
                disabled={data.questions.some((q) => q.unitId === editing.id)}
                onChange={(e) => setEditing({ ...editing, level: Number(e.target.value) })}
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} · {l.title}
                  </option>
                ))}
              </select>
              <small>Level paket yang sudah berisi soal tetap mengikuti level soalnya.</small>
            </label>
          </div>
          <label className="field">
            Tema
            <input
              required
              minLength={2}
              maxLength={120}
              value={editing.theme}
              onChange={(e) => setEditing({ ...editing, theme: e.target.value })}
            />
          </label>
          <label className="field">
            Deskripsi
            <textarea
              required
              minLength={2}
              maxLength={500}
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </label>
          <div className="actions">
            <button className="button primary" disabled={busy}>
              Simpan paket
            </button>
            <button type="button" className="button outline" onClick={() => setEditing(null)}>
              Batal
            </button>
          </div>
        </form>
      )}
      <div className="admin-package-grid">
        {data.units
          .filter((u) => u.title.toLowerCase().includes(search.toLowerCase()))
          .map((u) => {
            const questions = data.questions.filter((q) => q.unitId === u.id);
            return (
              <article className="panel" key={u.id}>
                <span className="status-chip">Level {u.level}</span>
                <h2>{u.title}</h2>
                <p>{u.description}</p>
                <small>
                  {
                    questions.filter((q) => q.pool === 'practice' && q.status === 'published')
                      .length
                  }{' '}
                  soal siap latihan & live · {questions.length} total
                </small>
                <div className="actions">
                  <Link className="button primary" href={'/admin/soal?paket=' + u.id}>
                    Atur soal <ArrowRight size={15} />
                  </Link>
                  <button
                    className="button outline"
                    onClick={() => {
                      setEditing(u);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Edit paket
                  </button>
                  {!questions.length && (
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Hapus paket kosong ini?'))
                          void mutate('delete-unit', { id: u.id }, 'Paket dihapus.');
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <PackageTools id={u.id} />
              </article>
            );
          })}
      </div>
    </>
  );
}
function Accounts() {
  const { data, busy, mutate } = useAdmin();
  const [search, setSearch] = useState('');
  return (
    <section className="panel">
      <label className="field">
        Cari pengguna
        <input
          placeholder="Nama atau email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <p>Menampilkan hingga 200 akun terbaru. Akun terverifikasi dapat menjadi host.</p>
      <div className="scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Progres</th>
              <th>Status email</th>
              <th>Akses</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.users
              .filter((u) => (u.name + u.email).toLowerCase().includes(search.toLowerCase()))
              .map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    Level {u.level}
                    <small>{u.onboarding ? 'Penempatan selesai' : 'Belum penempatan'}</small>
                  </td>
                  <td>{u.verifiedAt ? 'Terverifikasi' : 'Menunggu verifikasi'}</td>
                  <td>
                    <span className="admin-status">
                      {u.role === 'admin' ? 'Admin' : 'Pengguna'}
                    </span>
                  </td>
                  <td>
                    {u.id === data.currentUserId ? (
                      'Akun Anda'
                    ) : (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Ubah akses ${u.name} menjadi ${u.role === 'admin' ? 'pengguna' : 'admin'}?`,
                            )
                          )
                            void mutate('user-role', {
                              userId: u.id,
                              role: u.role === 'admin' ? 'student' : 'admin',
                            });
                        }}
                      >
                        {u.role === 'admin' ? 'Jadikan pengguna' : 'Jadikan admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Live() {
  const { data, busy, mutate } = useAdmin();
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{data.rooms.length} dari 5 ruang aktif</h2>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => void mutate('refresh', {}, 'Status ruang diperbarui.')}
        >
          <RefreshCw size={16} />
          Perbarui
        </button>
      </div>
      {!data.rooms.length ? (
        <div className="admin-empty">
          <Radio />
          <h3>Belum ada sesi berlangsung</h3>
          <p>Paket dengan soal terbit dapat dipakai untuk membuka ruang.</p>
          <Link className="button primary" href="/live">
            Buka sesi live
          </Link>
        </div>
      ) : (
        data.rooms.map((r) => (
          <div className="admin-coverage" key={r.id}>
            <strong>{r.code}</strong>
            <div>
              <strong>{r.host.name}</strong>
              <small>
                {r.status} · {r._count.participants}/30 peserta
              </small>
            </div>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Akhiri ruang ${r.code} untuk semua peserta?`))
                  void mutate('end-room', { code: r.code }, 'Sesi telah diakhiri.');
              }}
            >
              Akhiri sesi
            </button>
          </div>
        ))
      )}
    </section>
  );
}
function Reports() {
  const { data, busy, mutate } = useAdmin();
  return (
    <section className="panel">
      <h2>{data.reports.length} laporan perlu ditinjau</h2>
      {!data.reports.length && <div className="admin-empty">Belum ada laporan masuk.</div>}
      {data.reports.map((r) => (
        <article className="admin-report" key={r.id}>
          <h3>
            {data.questions.find((q) => q.id === r.questionId)?.data.prompt ?? 'Soal sudah dihapus'}
          </h3>
          <p>{r.message}</p>
          <div className="actions">
            <Link
              className="button outline"
              href={
                '/admin/soal?paket=' +
                (data.questions.find((q) => q.id === r.questionId)?.unitId ?? '')
              }
            >
              Buka paket soal
            </Link>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Tandai selesai dan hapus laporan ini dari antrean?'))
                  void mutate('resolve-report', { id: r.id }, 'Laporan ditangani.');
              }}
            >
              Tandai selesai
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
function Settings() {
  const { data, busy, mutate } = useAdmin();
  const [reviewer, setReviewer] = useState(data.review?.reviewer ?? '');
  return (
    <div className="admin-columns">
      <AppSettingsForm />
      <section className="panel">
        <span className="status-chip">
          {data.review?.approved ? 'Tes aktif' : 'Tes belum aktif'}
        </span>
        <h2>Tinjauan tes penempatan</h2>
        <p>
          Catat pengajar yang meninjau urutan level dan aturan tes. Ini berlaku untuk penempatan
          awal serta tes naik level.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate('review', { reviewer, approved: true });
          }}
        >
          <label className="field">
            Nama pengajar peninjau
            <input
              required
              minLength={3}
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            />
          </label>
          <div className="actions">
            <button className="button primary" disabled={busy}>
              Simpan persetujuan
            </button>
            {data.review?.approved && (
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    'review',
                    { reviewer: data.review?.reviewer ?? reviewer, approved: false },
                    'Akses tes ditutup.',
                  )
                }
              >
                Tutup akses tes
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Aturan aplikasi</h2>
        <p>Antarmuka berbahasa Indonesia, materi Arab fusha, dan akses gratis.</p>
        <dl className="admin-rules">
          <dt>Kapasitas sesi</dt>
          <dd>5 ruang × 30 peserta</dd>
          <dt>Tes penempatan</dt>
          <dd>15 soal · 3 per level</dd>
          <dt>Tes naik level</dt>
          <dd>10 soal · lulus 7 benar</dd>
          <dt>Pengulangan audio</dt>
          <dd>Maksimal 2 replay</dd>
        </dl>
        <p>Aturan ini ditampilkan sebagai referensi untuk pengelola konten.</p>
      </section>
    </div>
  );
}
