'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { Question } from '@/lib/contracts';
import { useAdmin } from './context';

function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : null;
}
const percent = (correct: number, total: number) =>
  total ? `${Math.round((correct / total) * 100)}%` : '—';
export function PackageTools({ id }: { id: string }) {
  const { data, mutate, busy } = useAdmin();
  const unit = data.units.find((u) => u.id === id)!;
  const [open, setOpen] = useState(false),
    [ids, setIds] = useState<string[]>([]);
  const rows = data.questions.filter((q) => q.unitId === id);
  return (
    <>
      <div className="actions">
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            void mutate(
              'duplicate-unit',
              { id },
              'Paket disalin. Semua soal salinan berstatus draft.',
            )
          }
        >
          Salin paket
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                unit.archived
                  ? 'Tampilkan kembali paket ini?'
                  : 'Arsipkan paket? Sesi yang sudah berjalan tetap dapat diselesaikan.',
              )
            )
              void mutate('archive-unit', { id, archived: !unit.archived });
          }}
        >
          {unit.archived ? 'Aktifkan paket' : 'Arsipkan paket'}
        </button>
        <button
          className="text-button"
          onClick={() => {
            setIds(rows.map((q) => q.id));
            setOpen(!open);
          }}
        >
          Atur urutan
        </button>
      </div>
      {unit.developmentOnly && (
        <p className="notice">
          Materi development · audio sintetis · tidak tersedia di production.
        </p>
      )}
      {unit.archived && (
        <p className="notice">Diarsipkan · tidak tersedia untuk latihan atau sesi baru.</p>
      )}
      {open && (
        <section aria-label="Urutan soal">
          <p>Urutan ini digunakan oleh latihan dan sesi live baru.</p>
          <ol>
            {ids.map((qid, i) => (
              <li key={qid}>
                <span>{rows.find((q) => q.id === qid)?.data.prompt}</span>
                <div className="actions">
                  {[-1, 1].map((d) => (
                    <button
                      key={d}
                      className="button outline"
                      aria-label={`${d < 0 ? 'Naik' : 'Turun'} soal ${i + 1}`}
                      disabled={i + d < 0 || i + d >= ids.length}
                      onClick={() =>
                        setIds((old) => {
                          const next = [...old];
                          [next[i], next[i + d]] = [next[i + d], next[i]];
                          return next;
                        })
                      }
                    >
                      {d < 0 ? '↑' : '↓'}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <button
            className="button primary"
            disabled={busy || !ids.length}
            onClick={async () => {
              if (await mutate('order-questions', { unitId: id, ids })) setOpen(false);
            }}
          >
            Simpan urutan
          </button>
        </section>
      )}
    </>
  );
}
export function RevisionHistory({
  question,
  onRestored,
}: {
  question: Question;
  onRestored: () => void;
}) {
  const { mutate, busy } = useAdmin();
  const [rows, setRows] = useState<{ version: number; createdAt: string; data: Question }[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState('');
  async function load() {
    try {
      setRows(await api('admin/history?id=' + encodeURIComponent(question.id)));
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <button
        type="button"
        className="text-button"
        onClick={() => (open ? setOpen(false) : void load())}
      >
        Riwayat revisi
      </button>
      <ErrorNotice error={error} />
      {open && (
        <>
          <p>Pemulihan membuat draft versi baru di paket saat ini. Riwayat sesi tidak berubah.</p>
          {!rows.length && <p>Riwayat mulai dicatat saat perubahan berikutnya disimpan.</p>}
          {rows.map((r) => (
            <details key={r.version}>
              <summary>
                Versi {r.version} · {new Date(r.createdAt).toLocaleString('id-ID')}
              </summary>
              <p>{r.data.prompt}</p>
              <p lang="ar" dir="rtl">
                {r.data.transcript}
              </p>
              <p>{r.data.explanation}</p>
              <button
                type="button"
                className="button outline"
                disabled={busy || r.version === question.version}
                onClick={async () => {
                  if (
                    window.confirm(
                      'Pulihkan versi ini? Perubahan editor yang belum disimpan akan dibuang.',
                    ) &&
                    (await mutate(
                      'restore-question',
                      { id: question.id, version: r.version, expectedVersion: question.version },
                      'Versi dipulihkan sebagai draft baru.',
                    ))
                  )
                    onRestored();
                }}
              >
                Pulihkan versi {r.version}
              </button>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  level: number;
  onboarding: boolean;
  verifiedAt: string | null;
  disabledAt: string | null;
};
type AttemptRow = {
  id: string;
  kind: string;
  level: number;
  createdAt: string;
  completedAt: string | null;
  correct: number;
  answered: number;
  score: number;
};
export function UserControls() {
  const { data, busy, mutate } = useAdmin();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<UserRow[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(''),
    [detail, setDetail] = useState<{ user: UserRow; attempts: AttemptRow[] } | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ rows: UserRow[]; total: number }>(
        `admin/users?search=${encodeURIComponent(search)}&page=${page}`,
      )
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setTotal(r.total);
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page, revision]);
  return (
    <section className="panel">
      <label className="field">
        Cari seluruh pengguna
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Nama atau email"
        />
      </label>
      <ErrorNotice error={error} />
      <p>{loading ? 'Memuat pengguna…' : `${total} akun ditemukan`}</p>
      <div className="scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Progres</th>
              <th>Status</th>
              <th>Akses</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.name}
                  <small>{u.email}</small>
                </td>
                <td>
                  Level {u.level}
                  <small>{u.onboarding ? 'Penempatan selesai' : 'Belum penempatan'}</small>
                </td>
                <td>{u.disabledAt ? 'Nonaktif' : u.verifiedAt ? 'Aktif' : 'Belum verifikasi'}</td>
                <td>{u.role === 'admin' ? 'Admin' : 'Pengguna'}</td>
                <td>
                  <div className="actions">
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          const r = await api<{ attempts: AttemptRow[] }>(
                            'admin/user-detail?id=' + u.id,
                          );
                          setDetail({ user: u, attempts: r.attempts });
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Detail
                    </button>
                    {u.id !== data.currentUserId && (
                      <>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              window.confirm(
                                `Ubah akses ${u.name}? Sesi login lama akan dicabut.`,
                              ) &&
                              (await mutate('user-role', {
                                userId: u.id,
                                role: u.role === 'admin' ? 'student' : 'admin',
                              }))
                            )
                              setRevision((n) => n + 1);
                          }}
                        >
                          {u.role === 'admin' ? 'Jadikan pengguna' : 'Jadikan admin'}
                        </button>
                        <button
                          className="text-button danger-text"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              window.confirm(
                                `${u.disabledAt ? 'Aktifkan' : 'Nonaktifkan'} akun ${u.name}?`,
                              ) &&
                              (await mutate('user-status', { id: u.id, disabled: !u.disabledAt }))
                            )
                              setRevision((n) => n + 1);
                          }}
                        >
                          {u.disabledAt ? 'Aktifkan' : 'Nonaktifkan'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button
          className="button outline"
          disabled={loading || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Sebelumnya
        </button>
        <span>
          Halaman {page + 1} / {Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="button outline"
          disabled={loading || (page + 1) * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Berikutnya
        </button>
      </div>
      {detail && (
        <section aria-label="Detail pengguna">
          <h2>Riwayat {detail.user.name}</h2>
          <p>Maksimal 50 percobaan terbaru. Akurasi dihitung dari jawaban yang sudah dikirim.</p>
          <button className="text-button" onClick={() => setDetail(null)}>
            Tutup detail
          </button>
          {!detail.attempts.length && <p>Belum ada riwayat belajar.</p>}
          {detail.attempts.map((a) => (
            <p key={a.id}>
              {new Date(a.createdAt).toLocaleString('id-ID')} · {a.kind} · Level {a.level} ·{' '}
              {a.completedAt ? 'Selesai' : 'Berlangsung'} · {a.correct}/{a.answered} benar ·{' '}
              {a.score} poin
            </p>
          ))}
        </section>
      )}
    </section>
  );
}
export function AppSettingsForm() {
  const { data, mutate, busy } = useAdmin();
  const [value, setValue] = useState(data.settings);
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        void mutate('settings', value);
      }}
    >
      <h2>Identitas aplikasi</h2>
      <label className="field">
        Nama aplikasi
        <input
          required
          minLength={2}
          maxLength={60}
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </label>
      <label className="field">
        Kalimat pengantar
        <input
          required
          minLength={2}
          maxLength={180}
          value={value.tagline}
          onChange={(e) => setValue({ ...value, tagline: e.target.value })}
        />
      </label>
      <label className="field">
        Email bantuan
        <input
          type="email"
          maxLength={254}
          value={value.supportEmail}
          onChange={(e) => setValue({ ...value, supportEmail: e.target.value })}
        />
      </label>
      <p>Tampil pada navigasi, footer, dan halaman bantuan setelah halaman dimuat ulang.</p>
      <button className="button primary" disabled={busy}>
        Simpan identitas
      </button>
    </form>
  );
}
type Analytics = {
  since: string;
  totalAnswers: number;
  correctAnswers: number;
  completed: number;
  questions: { id: string; prompt: string; answered: number; correct: number }[];
  packages: { id: string; answered: number; correct: number; completed: number }[];
  rooms: {
    code: string;
    createdAt: string;
    status: string;
    participants: {
      name: string;
      answered: number;
      correct: number;
      score: number;
      elapsedMs: number;
    }[];
  }[];
};
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (value: string | number) =>
    '"' +
    String(value)
      .replace(/^[=+@\-\t\r]/, (s) => "'" + s)
      .replaceAll('"', '""') +
    '"';
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AnalyticsPanel() {
  const { data } = useAdmin();
  const [result, setResult] = useState<Analytics | null>(null),
    [error, setError] = useState('');
  async function load() {
    try {
      setResult(await api('admin/analytics'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <ErrorNotice error={error} />
      <button className="button outline" onClick={() => void load()}>
        Perbarui hasil
      </button>
      {!result ? (
        <p>Memuat hasil belajar…</p>
      ) : (
        <>
          <p>
            Periode 90 hari sejak {new Date(result.since).toLocaleDateString('id-ID')}. Akurasi
            mencakup semua jawaban terkirim, termasuk pengulangan; bukan akurasi jawaban pertama
            untuk membuka tes.
          </p>
          <div className="admin-stats">
            {[
              ['Jawaban terkirim', result.totalAnswers],
              ['Akurasi keseluruhan', percent(result.correctAnswers, result.totalAnswers)],
              ['Percobaan selesai', result.completed],
            ].map(([label, value]) => (
              <div className="panel" key={label}>
                <small>{label}</small>
                <h2>{value}</h2>
              </div>
            ))}
          </div>
          <section className="panel">
            <h2>Hasil latihan per paket</h2>
            <button
              className="button outline"
              onClick={() =>
                downloadCsv('hasil-paket.csv', [
                  ['Paket', 'Selesai', 'Benar', 'Jawaban', 'Akurasi'],
                  ...result.packages.map((p) => [
                    data.units.find((u) => u.id === p.id)?.title ?? p.id,
                    p.completed,
                    p.correct,
                    p.answered,
                    percent(p.correct, p.answered),
                  ]),
                ])
              }
            >
              Ekspor hasil paket
            </button>
            {!result.packages.length && <p>Belum ada latihan dalam periode ini.</p>}
            {result.packages.map((p) => (
              <p key={p.id}>
                {data.units.find((u) => u.id === p.id)?.title ?? 'Paket dihapus'} · {p.completed}{' '}
                selesai · {p.correct}/{p.answered} benar ({percent(p.correct, p.answered)})
              </p>
            ))}
          </section>
          <section className="panel">
            <h2>Soal yang perlu ditinjau</h2>
            <p>
              Diurutkan dari akurasi terendah. Perhatikan jumlah jawaban sebelum menilai tingkat
              kesulitan.
            </p>
            {result.questions.slice(0, 20).map((q) => (
              <p key={q.id}>
                {q.prompt} · {q.correct}/{q.answered} benar ({percent(q.correct, q.answered)})
              </p>
            ))}
            {!result.questions.length && <p>Belum ada jawaban.</p>}
          </section>
          <section className="panel">
            <h2>Hasil sesi live</h2>
            <p>Maksimal 100 sesi terbaru dalam periode 90 hari.</p>
            {!result.rooms.length && <p>Belum ada sesi.</p>}
            {result.rooms.map((r) => (
              <details key={r.code}>
                <summary>
                  {r.code} · {r.status} · {new Date(r.createdAt).toLocaleString('id-ID')} ·{' '}
                  {r.participants.length} peserta
                </summary>
                <button
                  className="button outline"
                  onClick={() =>
                    downloadCsv(`sesi-${r.code}.csv`, [
                      ['Nama', 'Skor', 'Benar', 'Jawaban', 'Waktu ms'],
                      ...r.participants.map((p) => [
                        p.name,
                        p.score,
                        p.correct,
                        p.answered,
                        p.elapsedMs,
                      ]),
                    ])
                  }
                >
                  Ekspor sesi {r.code}
                </button>
                {r.participants.map((p, i) => (
                  <p key={i}>
                    {p.name} · {p.score} poin · {p.correct}/{p.answered} benar
                  </p>
                ))}
              </details>
            ))}
          </section>
        </>
      )}
    </>
  );
}
